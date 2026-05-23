"""TypedDict mirror of the ``RoomEvent`` union from ``packages/shared/src/events.ts``.

The TS source uses a discriminated union on the ``type`` field. Python doesn't
have native discriminated unions, so we expose:

  * a ``TypedDict`` per variant (matching keys and JSON shape exactly), and
  * ``RoomEvent`` as the ``Union`` of all variants for typing.

Runtime parsing is just ``json.loads`` — the event arrives as a plain ``dict``
that conforms to one of these shapes. Use ``event["type"]`` to discriminate.
"""

from __future__ import annotations

from typing import Literal, TypedDict, Union


class RoomJoined(TypedDict):
    type: Literal["room.joined"]
    participantId: str
    role: Literal["agent", "human"]
    at: int


class ParticipantJoined(TypedDict):
    type: Literal["participant.joined"]
    participantId: str
    displayName: str
    role: Literal["agent", "human"]
    at: int


class ParticipantLeft(TypedDict):
    type: Literal["participant.left"]
    participantId: str
    reason: str
    at: int


class SpeechStarted(TypedDict):
    type: Literal["speech.started"]
    participantId: str
    at: int


class SpeechEnded(TypedDict):
    type: Literal["speech.ended"]
    participantId: str
    at: int


class TranscriptPartial(TypedDict):
    type: Literal["transcript.partial"]
    participantId: str
    text: str
    chunkId: str
    at: int


class TranscriptFinal(TypedDict, total=False):
    type: Literal["transcript.final"]
    participantId: str
    text: str
    chunkId: str
    confidence: float
    at: int


class ChatMessage(TypedDict):
    type: Literal["chat.message"]
    participantId: str
    text: str
    at: int


class RecordingStarted(TypedDict):
    type: Literal["recording.started"]
    egressId: str
    at: int


class RecordingStopped(TypedDict):
    type: Literal["recording.stopped"]
    egressId: str
    durationMs: int
    at: int


class ErrorEvent(TypedDict):
    type: Literal["error"]
    code: str
    message: str
    recoverable: bool


RoomEvent = Union[
    RoomJoined,
    ParticipantJoined,
    ParticipantLeft,
    SpeechStarted,
    SpeechEnded,
    TranscriptPartial,
    TranscriptFinal,
    ChatMessage,
    RecordingStarted,
    RecordingStopped,
    ErrorEvent,
]

# Set of valid discriminator values; useful for runtime validation in sim code.
EVENT_TYPES: frozenset[str] = frozenset(
    {
        "room.joined",
        "participant.joined",
        "participant.left",
        "speech.started",
        "speech.ended",
        "transcript.partial",
        "transcript.final",
        "chat.message",
        "recording.started",
        "recording.stopped",
        "error",
    }
)

__all__ = [
    "ChatMessage",
    "ErrorEvent",
    "EVENT_TYPES",
    "ParticipantJoined",
    "ParticipantLeft",
    "RecordingStarted",
    "RecordingStopped",
    "RoomEvent",
    "RoomJoined",
    "SpeechEnded",
    "SpeechStarted",
    "TranscriptFinal",
    "TranscriptPartial",
]
