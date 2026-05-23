"""callplatform — Python BYO-agent SDK + deterministic sim runtime for roomKit.

Two products in one package:

1. ``callplatform.join(...)`` — async context manager that opens a WebSocket to
   a real roomKit gateway and exposes ``recv()``, ``send()``, and ``events()``.
2. ``callplatform.sim.SimulatedRoom`` — fully in-process deterministic fake
   that mirrors the same API surface for unit tests without any network.

The wire contract (16 kHz mono PCM int16 LE, 20 ms / 640-byte frames, JSON
text frames for RoomEvent control) is mirrored exactly from
``packages/shared/src/wire.ts``.
"""

from .wire import AUDIO, ENDPOINTS, WIRE_VERSION, frames_in, is_valid_audio_frame
from .events import RoomEvent
from .client import Room, join
from . import sim

__all__ = [
    "AUDIO",
    "ENDPOINTS",
    "WIRE_VERSION",
    "Room",
    "RoomEvent",
    "frames_in",
    "is_valid_audio_frame",
    "join",
    "sim",
]

__version__ = "0.1.0"
