# callplatform — Python BYO-agent SDK for roomKit

Two products in one package:

1. **`callplatform.join()`** — async context manager that opens a WebSocket
   to a real roomKit gateway. Exposes `recv() -> bytes`, `send(bytes)`,
   `send_event(dict)`, and `events()`. Talks the frozen wire contract:
   16 kHz mono PCM int16 LE, 20 ms (640-byte) frames; JSON text frames for
   `RoomEvent` control.
2. **`callplatform.sim.SimulatedRoom`** — deterministic in-process fake with
   the same API surface. Unit-test agents with `pytest` and zero infra.

## Install

```bash
cd packages/sim-sdk-py
python3 -m pip install -e .
```

## Real-gateway example (10 lines)

```python
import asyncio, callplatform

async def main(room_id: str, token: str):
    async with callplatform.join(room_id, token,
                                 gateway_url="ws://localhost:3000") as room:
        async for ev in room.events():
            if ev["type"] == "speech.ended":
                pcm = await room.recv()
                await room.send(pcm)  # echo it back

asyncio.run(main("room-abc", "tok-xyz"))
```

## Sim example (10 lines, no network)

```python
import asyncio
from callplatform.sim import SimulatedRoom, silence_frame

async def main():
    async with SimulatedRoom() as room:
        room.script_event({"type": "room.joined", "participantId": "a", "role": "agent", "at": 1})
        room.script_event({"type": "speech.ended", "participantId": "h", "at": 2})
        room.script_audio(silence_frame())
        room.finish()
        async for ev in room.events():
            if ev["type"] == "speech.ended":
                await room.send(await room.recv())
        assert len(room.sent_audio) == 1

asyncio.run(main())
```

## Test

```bash
python3 -m pip install -e '.[dev]'
python3 -m pytest tests/ -q
```

## Wire contract (mirrored from `packages/shared/src/wire.ts`)

| Field | Value |
| --- | --- |
| `sampleRate` | 16000 Hz |
| `channels` | 1 (mono) |
| `bitsPerSample` | 16 |
| `encoding` | `pcm_s16le` |
| `frameMs` | 20 |
| `samplesPerFrame` | 320 |
| `bytesPerFrame` | 640 |

The TS file is the source of truth. Python values are duplicated, not derived,
so `tests/test_wire.py` catches drift in either direction.
