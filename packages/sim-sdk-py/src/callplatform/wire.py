"""Mirror of ``packages/shared/src/wire.ts``.

FROZEN — any change here must be coordinated with the TS source of truth.
The TS file is the canonical specification; this module is a literal Python
transcription. The values are duplicated (not derived) so a regression in
either file is caught by ``tests/test_wire.py``.
"""

from __future__ import annotations

from typing import Callable, Literal, TypedDict

WIRE_VERSION: str = "0.1.0"


class _AudioSpec(TypedDict):
    sampleRate: int
    channels: int
    bitsPerSample: int
    encoding: Literal["pcm_s16le"]
    frameMs: int
    samplesPerFrame: int
    bytesPerFrame: int


# Mirrors `AUDIO` in wire.ts. 16 kHz mono int16 LE, 20 ms = 320 samples = 640 bytes.
AUDIO: _AudioSpec = {
    "sampleRate": 16_000,
    "channels": 1,
    "bitsPerSample": 16,
    "encoding": "pcm_s16le",
    "frameMs": 20,
    "samplesPerFrame": 320,
    "bytesPerFrame": 640,
}


StreamMode = Literal["mixed", "per-track"]


def _agent_ws_path(room_id: str, token: str, stream: StreamMode = "mixed") -> str:
    """Mirror of ``ENDPOINTS.agentWs(roomId, token, stream)`` from wire.ts."""
    from urllib.parse import quote

    return f"/v1/rooms/{room_id}/agent?token={quote(token, safe='')}&stream={stream}"


class _Endpoints(TypedDict):
    agentWs: Callable[..., str]
    rooms: str
    room: Callable[[str], str]
    roomTokens: Callable[[str], str]
    roomTranscript: Callable[[str], str]
    roomSummary: Callable[[str], str]
    roomRecording: Callable[[str], str]
    webhooks: str


ENDPOINTS: _Endpoints = {
    "agentWs": _agent_ws_path,
    "rooms": "/v1/rooms",
    "room": lambda id: f"/v1/rooms/{id}",
    "roomTokens": lambda id: f"/v1/rooms/{id}/tokens",
    "roomTranscript": lambda id: f"/v1/rooms/{id}/transcript",
    "roomSummary": lambda id: f"/v1/rooms/{id}/summary",
    "roomRecording": lambda id: f"/v1/rooms/{id}/recording",
    "webhooks": "/v1/webhooks/livekit",
}


class AgentJwtClaims(TypedDict, total=False):
    role: Literal["agent", "human"]
    identity: str
    room: str
    iat: int
    exp: int


def is_valid_audio_frame(byte_length: int) -> bool:
    """Return True iff ``byte_length`` is a positive multiple of bytesPerFrame.

    Mirrors ``isValidAudioFrame(byteLength)`` in wire.ts.
    """
    return byte_length > 0 and byte_length % AUDIO["bytesPerFrame"] == 0


def frames_in(byte_length: int) -> int:
    """Number of 20 ms frames in a buffer. Mirrors ``framesIn`` in wire.ts."""
    return byte_length // AUDIO["bytesPerFrame"]
