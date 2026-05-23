"""Mirror checks against ``packages/shared/src/wire.ts``.

The numbers below are hard-coded — they are the contract. Importing them from
the TS source would defeat the purpose of these tests, which is to catch drift
in either direction.
"""

from callplatform import AUDIO, ENDPOINTS, WIRE_VERSION, frames_in, is_valid_audio_frame


def test_wire_version_mirrors_ts() -> None:
    assert WIRE_VERSION == "0.1.0"


def test_audio_constants_mirror_ts() -> None:
    # Values mirrored from packages/shared/src/wire.ts AUDIO block.
    assert AUDIO["sampleRate"] == 16_000
    assert AUDIO["channels"] == 1
    assert AUDIO["bitsPerSample"] == 16
    assert AUDIO["encoding"] == "pcm_s16le"
    assert AUDIO["frameMs"] == 20
    assert AUDIO["samplesPerFrame"] == 320
    assert AUDIO["bytesPerFrame"] == 640


def test_frame_arithmetic_self_consistent() -> None:
    # samplesPerFrame * bitsPerSample/8 * channels == bytesPerFrame
    assert (
        AUDIO["samplesPerFrame"]
        * (AUDIO["bitsPerSample"] // 8)
        * AUDIO["channels"]
        == AUDIO["bytesPerFrame"]
    )
    # sampleRate * frameMs / 1000 == samplesPerFrame
    assert AUDIO["sampleRate"] * AUDIO["frameMs"] // 1000 == AUDIO["samplesPerFrame"]


def test_is_valid_audio_frame_640_is_valid() -> None:
    assert is_valid_audio_frame(640) is True
    assert is_valid_audio_frame(1280) is True
    assert is_valid_audio_frame(640 * 50) is True


def test_is_valid_audio_frame_rejects_off_size() -> None:
    assert is_valid_audio_frame(0) is False
    assert is_valid_audio_frame(1) is False
    assert is_valid_audio_frame(320) is False
    assert is_valid_audio_frame(641) is False
    assert is_valid_audio_frame(-640) is False


def test_frames_in_counts_correctly() -> None:
    assert frames_in(0) == 0
    assert frames_in(640) == 1
    assert frames_in(1280) == 2
    assert frames_in(639) == 0
    assert frames_in(640 * 100) == 100


def test_endpoints_mirror_ts() -> None:
    assert ENDPOINTS["rooms"] == "/v1/rooms"
    assert ENDPOINTS["webhooks"] == "/v1/webhooks/livekit"
    assert ENDPOINTS["room"]("abc") == "/v1/rooms/abc"
    assert ENDPOINTS["roomTokens"]("abc") == "/v1/rooms/abc/tokens"
    assert ENDPOINTS["roomTranscript"]("abc") == "/v1/rooms/abc/transcript"
    assert ENDPOINTS["roomSummary"]("abc") == "/v1/rooms/abc/summary"
    assert ENDPOINTS["roomRecording"]("abc") == "/v1/rooms/abc/recording"


def test_agent_ws_path_mirrors_ts_signature() -> None:
    # Default stream mode is 'mixed'; token is URL-encoded.
    path = ENDPOINTS["agentWs"]("room-1", "tok+/=abc")
    assert path == "/v1/rooms/room-1/agent?token=tok%2B%2F%3Dabc&stream=mixed"

    per_track = ENDPOINTS["agentWs"]("room-2", "xyz", "per-track")
    assert per_track == "/v1/rooms/room-2/agent?token=xyz&stream=per-track"
