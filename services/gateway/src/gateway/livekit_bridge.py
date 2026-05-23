import asyncio
import argparse
import sys
import json
import traceback
import websockets
from livekit import rtc

# Simple, high-performance resampling
def resample_48k_to_16k(data_bytes: bytes) -> bytes:
    # 48kHz Int16 LE -> 16kHz Int16 LE
    # Decimate by taking every 3rd sample (2 bytes per sample)
    out = bytearray(len(data_bytes) // 3)
    for i in range(0, len(data_bytes) // 6):
        out[i*2] = data_bytes[i*6]
        out[i*2+1] = data_bytes[i*6+1]
    return bytes(out)

def resample_16k_to_48k(data_bytes: bytes) -> bytes:
    # 16kHz Int16 LE -> 48kHz Int16 LE
    # Interpolate by repeating each sample 3 times
    out = bytearray(len(data_bytes) * 3)
    for i in range(0, len(data_bytes) // 2):
        s0 = data_bytes[i*2]
        s1 = data_bytes[i*2+1]
        idx = i * 6
        out[idx] = s0
        out[idx+1] = s1
        out[idx+2] = s0
        out[idx+3] = s1
        out[idx+4] = s0
        out[idx+5] = s1
    return bytes(out)

class LiveKitBridge:
    def __init__(self, room_name: str, lk_token: str, local_ws_url: str,
                 stream_mode: str = "mixed", target_participant_id: str = ""):
        self.room_name = room_name
        self.lk_token = lk_token
        self.local_ws_url = local_ws_url
        self.stream_mode = stream_mode  # "mixed" | "per-track"
        self.target_participant_id = target_participant_id
        self.room = rtc.Room()
        self.ws = None
        self.audio_source = rtc.AudioSource(48000, 1) # 48kHz, mono
        self.track = None
        self.running = True

    async def connect_local_ws(self):
        print(f"Connecting to local gateway WS: {self.local_ws_url}", flush=True)
        self.ws = await websockets.connect(self.local_ws_url)
        print("Connected to local gateway WS!", flush=True)

    async def run(self):
        # 1. Connect to local gateway WS
        await self.connect_local_ws()

        # 2. Setup LiveKit room event handlers
        @self.room.on("participant_joined")
        def on_participant_joined(participant: rtc.RemoteParticipant):
            self.send_event({
                "type": "participant.joined",
                "participantId": participant.identity,
                "displayName": participant.name or "",
                "role": "human" if "agent" not in participant.identity else "agent",
                "at": int(asyncio.get_event_loop().time() * 1000)
            })

        @self.room.on("participant_left")
        def on_participant_left(participant: rtc.RemoteParticipant):
            self.send_event({
                "type": "participant.left",
                "participantId": participant.identity,
                "reason": "left call",
                "at": int(asyncio.get_event_loop().time() * 1000)
            })

        @self.room.on("track_subscribed")
        def on_track_subscribed(track: rtc.Track, publication: rtc.TrackPublication, participant: rtc.RemoteParticipant):
            if track.kind != rtc.TrackKind.KIND_AUDIO:
                return
            # Per-track stream mode: only forward audio from the requested participant.
            # Other participants' tracks are dropped at the bridge so the client WS
            # carries a single-speaker stream end-to-end.
            if self.stream_mode == "per-track" and participant.identity != self.target_participant_id:
                print(f"[per-track] dropping audio from {participant.identity} (target={self.target_participant_id})", flush=True)
                return
            print(f"Subscribed to remote audio track: {track.sid} from {participant.identity}", flush=True)
            asyncio.create_task(self.receive_track_audio(track, participant.identity))

        # 3. Connect to LiveKit Room
        lk_url = "ws://localhost:7880"
        print(f"Connecting to LiveKit: {lk_url} in room {self.room_name}", flush=True)
        await self.room.connect(lk_url, self.lk_token)
        print(f"Connected to LiveKit room: {self.room.name}", flush=True)

        # 4. Publish agent's local audio track
        self.track = rtc.LocalAudioTrack.create_audio_track("microphone", self.audio_source)
        options = rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE)
        await self.room.local_participant.publish_track(self.track, options)
        print("Agent microphone track published!", flush=True)

        # Send room joined confirmation
        self.send_event({
            "type": "room.joined",
            "participantId": self.room.local_participant.identity,
            "role": "agent",
            "at": int(asyncio.get_event_loop().time() * 1000)
        })

        # Emit current participants list so per-track clients can discover identities
        # without polling REST. Additive event — not in the frozen RoomEvent union;
        # clients that don't know about it should ignore unknown types per spec.
        remote_participants = [
            {
                "participantId": p.identity,
                "displayName": p.name or "",
                "role": "agent" if "agent" in p.identity else "human",
            }
            for p in self.room.participants.values()
        ]
        self.send_event({
            "type": "participants.list",
            "participants": remote_participants,
            "streamMode": self.stream_mode,
            "targetParticipantId": self.target_participant_id or None,
            "at": int(asyncio.get_event_loop().time() * 1000),
        })

        # 5. Start bidirection routing
        await asyncio.gather(
            self.read_from_local_ws(),
            self.heartbeat()
        )

    def send_event(self, event: dict):
        if self.ws and self.ws.open:
            asyncio.create_task(self.ws.send(json.dumps(event)))

    async def heartbeat(self):
        while self.running:
            await asyncio.sleep(5)
            # Keep-alive
            if self.ws and self.ws.closed:
                print("Local WS closed. Exiting...", flush=True)
                self.running = False
                break

    async def receive_track_audio(self, track: rtc.Track, participant_id: str):
        # Read frames from LiveKit, resample, and push to WS
        audio_stream = rtc.AudioStream(track)
        async for frame in audio_stream:
            if not self.running:
                break
            # LiveKit frames are typically 48kHz mono/stereo float32 or int16.
            # Convert to mono 48kHz int16 if needed
            data = frame.data # bytes
            # Resample 48k to 16k
            resampled = resample_48k_to_16k(data)
            # Send to local WS as binary frame
            if self.ws and self.ws.open:
                try:
                    await self.ws.send(resampled)
                except Exception as e:
                    print(f"Error sending audio to local WS: {e}", flush=True)

    async def read_from_local_ws(self):
        # Read audio frames from local WS, resample, and capture into LiveKit AudioSource
        try:
            async for message in self.ws:
                if isinstance(message, bytes):
                    # 16kHz mono Int16 LE -> 48kHz mono Int16 LE
                    resampled = resample_16k_to_48k(message)
                    # Create LiveKit frame
                    # 20ms of 16kHz mono = 640 bytes (320 samples)
                    # Resampled: 20ms of 48kHz mono = 1920 bytes (960 samples)
                    samples_per_channel = len(resampled) // 2
                    frame = rtc.AudioFrame(
                        resampled,
                        sample_rate=48000,
                        num_channels=1,
                        samples_per_channel=samples_per_channel
                    )
                    await self.audio_source.capture_frame(frame)
                else:
                    # JSON control event sent from external agent
                    event = json.loads(message)
                    print(f"Received custom event from agent: {event}", flush=True)
                    # We can forward this as a LiveKit data channel message
                    await self.room.local_participant.publish_data(
                        json.dumps(event),
                        topic="roomkit_control"
                    )
        except Exception as e:
            print(f"Error reading from local WS: {e}", flush=True)
            traceback.print_exc()
        finally:
            self.running = False
            await self.room.disconnect()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--room", required=True)
    parser.add_argument("--token", required=True)
    parser.add_argument("--local-ws", required=True)
    parser.add_argument("--stream", choices=["mixed", "per-track"], default="mixed")
    parser.add_argument("--participant-id", default="")
    args = parser.parse_args()

    if args.stream == "per-track" and not args.participant_id:
        print("ERROR: --participant-id required when --stream=per-track", flush=True)
        raise SystemExit(2)

    bridge = LiveKitBridge(
        args.room,
        args.token,
        args.local_ws,
        stream_mode=args.stream,
        target_participant_id=args.participant_id,
    )
    try:
        asyncio.run(bridge.run())
    except KeyboardInterrupt:
        print("Bridge interrupted", flush=True)
