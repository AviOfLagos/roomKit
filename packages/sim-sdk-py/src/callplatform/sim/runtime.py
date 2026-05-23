"""``SimulatedRoom`` — deterministic in-process fake roomKit gateway.

Exposes the same API surface as the real ``Room`` returned by
``callplatform.join()`` so agents written against the real SDK can be
unit-tested with ``pytest`` and zero network. This is the "competitive moat"
per ``docs/call-platform-feasibility.md`` §7.

Scripted behaviour:
  * Pre-load events via ``script_event(ev)`` / ``script_events(iter)``.
  * Pre-load inbound audio frames via ``script_audio(frame)`` /
    ``script_audio_frames(iter)``.
  * Order between events and audio is preserved in the order ``script_*``
    is called, so tests can interleave deterministically.
  * Outbound calls from the agent (``send``, ``send_event``) are captured
    in ``sent_audio`` and ``sent_events`` lists for assertions.

Usage::

    async with SimulatedRoom() as room:
        room.script_event({"type": "room.joined", ...})
        room.script_event({"type": "speech.ended", ...})
        room.script_audio(silence_frame())
        room.finish()

        events = []
        async for ev in room.events():
            events.append(ev)
            if ev["type"] == "speech.ended":
                pcm = await room.recv()
                await room.send(pcm)
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Iterable, Optional

from ..events import EVENT_TYPES, RoomEvent
from ..wire import AUDIO, is_valid_audio_frame


_SENTINEL_EOS = object()


def silence_frame() -> bytes:
    """A single 20 ms / 640-byte zero-filled PCM frame."""
    return b"\x00" * AUDIO["bytesPerFrame"]


class SimulatedRoom:
    """In-process fake of a connected roomKit room.

    Implements the same ``recv() / send() / send_event() / events()`` shape
    as the real ``Room`` so agent code is transport-agnostic.
    """

    def __init__(self) -> None:
        self._event_q: asyncio.Queue[Any] = asyncio.Queue()
        self._audio_q: asyncio.Queue[Any] = asyncio.Queue()
        self.sent_audio: list[bytes] = []
        self.sent_events: list[dict[str, Any]] = []
        self._finished = False
        self._closed = False

    # ---------- scripting API ----------

    def script_event(self, event: RoomEvent | dict[str, Any]) -> "SimulatedRoom":
        """Queue a ``RoomEvent`` to be delivered to the agent."""
        if self._finished:
            raise RuntimeError("cannot script after finish() / close()")
        ev_type = event.get("type") if isinstance(event, dict) else None
        if ev_type not in EVENT_TYPES:
            raise ValueError(
                f"unknown RoomEvent.type={ev_type!r}; valid types are {sorted(EVENT_TYPES)}"
            )
        self._event_q.put_nowait(dict(event))
        return self

    def script_events(self, events: Iterable[RoomEvent | dict[str, Any]]) -> "SimulatedRoom":
        for ev in events:
            self.script_event(ev)
        return self

    def script_audio(self, frame: bytes) -> "SimulatedRoom":
        """Queue a binary audio frame to be delivered to the agent."""
        if self._finished:
            raise RuntimeError("cannot script after finish() / close()")
        if not is_valid_audio_frame(len(frame)):
            raise ValueError(
                f"frame length {len(frame)} not a positive multiple of "
                f"{AUDIO['bytesPerFrame']} bytes"
            )
        self._audio_q.put_nowait(frame)
        return self

    def script_audio_frames(self, frames: Iterable[bytes]) -> "SimulatedRoom":
        for f in frames:
            self.script_audio(f)
        return self

    def finish(self) -> None:
        """Signal that no more scripted input will arrive.

        After calling, ``recv()`` returns ``b""`` once the audio queue drains
        and ``events()`` terminates once the event queue drains.
        """
        if self._finished:
            return
        self._finished = True
        self._event_q.put_nowait(_SENTINEL_EOS)
        self._audio_q.put_nowait(_SENTINEL_EOS)

    # ---------- agent-facing API (mirror of Room) ----------

    async def recv(self) -> bytes:
        item = await self._audio_q.get()
        if item is _SENTINEL_EOS:
            # re-arm sentinel so subsequent calls also see EOS
            self._audio_q.put_nowait(_SENTINEL_EOS)
            return b""
        return item

    async def send(self, frame: bytes) -> None:
        if not is_valid_audio_frame(len(frame)):
            raise ValueError(
                f"audio frame length {len(frame)} is not a positive multiple "
                f"of {AUDIO['bytesPerFrame']} bytes"
            )
        self.sent_audio.append(frame)

    async def send_event(self, event: RoomEvent | dict[str, Any]) -> None:
        self.sent_events.append(dict(event))

    async def events(self) -> AsyncIterator[RoomEvent]:
        while True:
            item = await self._event_q.get()
            if item is _SENTINEL_EOS:
                self._event_q.put_nowait(_SENTINEL_EOS)
                return
            yield item

    async def close(self) -> None:
        self._closed = True
        if not self._finished:
            self.finish()

    # ---------- context manager sugar ----------

    async def __aenter__(self) -> "SimulatedRoom":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self.close()


@asynccontextmanager
async def join(
    *,
    room: Optional[SimulatedRoom] = None,
) -> AsyncIterator[SimulatedRoom]:
    """Sim equivalent of ``callplatform.join()`` — pass a pre-scripted room.

    Provided so test code can swap ``callplatform.join`` for
    ``callplatform.sim.join`` with a single import change.
    """
    sim_room = room or SimulatedRoom()
    try:
        yield sim_room
    finally:
        await sim_room.close()


__all__ = ["SimulatedRoom", "join", "silence_frame"]
