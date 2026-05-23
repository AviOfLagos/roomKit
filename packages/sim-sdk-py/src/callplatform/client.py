"""Real WebSocket client. ``callplatform.join()`` opens a WS to the roomKit
gateway and exposes three primitives:

* ``await room.recv() -> bytes``  — next 640-byte PCM frame (binary WS frame).
* ``await room.send(frame)``      — push a binary audio frame upstream.
* ``async for ev in room.events()`` — JSON ``RoomEvent`` text frames.

The client is intentionally opaque to transport details beyond the frozen
wire contract. No LiveKit imports anywhere — this SDK is WS-only.
"""

from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Optional
from urllib.parse import quote

import websockets
from websockets.asyncio.client import ClientConnection, connect

from .events import RoomEvent
from .wire import AUDIO, is_valid_audio_frame


class Room:
    """Connected roomKit audio bridge session.

    Instances are produced by ``join()`` and should only be used inside its
    ``async with`` block. The class demultiplexes incoming WS frames into two
    queues (binary audio, JSON control) so callers can ``recv()`` and iterate
    ``events()`` independently without races.
    """

    def __init__(self, ws: ClientConnection):
        self._ws = ws
        self._audio_q: asyncio.Queue[bytes] = asyncio.Queue()
        self._event_q: asyncio.Queue[Optional[RoomEvent]] = asyncio.Queue()
        self._closed = asyncio.Event()
        self._pump_task: Optional[asyncio.Task[None]] = None

    def _start(self) -> None:
        self._pump_task = asyncio.create_task(self._pump(), name="callplatform.pump")

    async def _pump(self) -> None:
        try:
            async for msg in self._ws:
                if isinstance(msg, (bytes, bytearray, memoryview)):
                    await self._audio_q.put(bytes(msg))
                else:
                    try:
                        ev = json.loads(msg)
                    except json.JSONDecodeError:
                        continue
                    await self._event_q.put(ev)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self._closed.set()
            # Wake any pending recv/events iterators.
            await self._event_q.put(None)
            await self._audio_q.put(b"")

    async def recv(self) -> bytes:
        """Await the next binary audio frame.

        Returns ``b""`` if the connection has been closed and no more frames
        are available.
        """
        frame = await self._audio_q.get()
        return frame

    async def send(self, frame: bytes) -> None:
        """Send a binary audio frame upstream.

        ``frame`` MUST be a positive multiple of ``AUDIO['bytesPerFrame']``
        (640) per the wire contract. Raises ``ValueError`` otherwise.
        """
        if not is_valid_audio_frame(len(frame)):
            raise ValueError(
                f"audio frame length {len(frame)} is not a positive multiple "
                f"of {AUDIO['bytesPerFrame']} bytes"
            )
        await self._ws.send(frame)

    async def send_event(self, event: RoomEvent | dict[str, Any]) -> None:
        """Send a JSON ``RoomEvent`` text frame upstream."""
        await self._ws.send(json.dumps(event))

    async def events(self) -> AsyncIterator[RoomEvent]:
        """Async iterator over inbound ``RoomEvent`` JSON frames.

        Terminates cleanly when the underlying WS closes.
        """
        while True:
            ev = await self._event_q.get()
            if ev is None:
                return
            yield ev

    async def close(self) -> None:
        if self._pump_task is not None:
            self._pump_task.cancel()
            try:
                await self._pump_task
            except (asyncio.CancelledError, Exception):
                pass
        await self._ws.close()


def _build_url(
    gateway_url: str,
    room_id: str,
    token: str,
    stream: str = "mixed",
    participant_id: str = "",
) -> str:
    base = gateway_url.rstrip("/")
    url = (
        f"{base}/v1/rooms/{room_id}/agent"
        f"?token={quote(token, safe='')}&stream={stream}"
    )
    if participant_id:
        url += f"&participantId={quote(participant_id, safe='')}"
    return url


@asynccontextmanager
async def join(
    room_id: str,
    token: str,
    *,
    gateway_url: str = "ws://localhost:3000",
    stream: str = "mixed",
    participant_id: str = "",
) -> AsyncIterator[Room]:
    """Open a WebSocket session to the roomKit gateway as a BYO agent.

    Yields a ``Room`` exposing ``recv()``, ``send()``, ``send_event()`` and
    ``events()``. Closes the socket on exit.

    Example::

        async with callplatform.join(room_id, token) as room:
            async for ev in room.events():
                if ev["type"] == "speech.ended":
                    pcm = await room.recv()
                    await room.send(pcm)  # echo
    """
    if stream == "per-track" and not participant_id:
        raise ValueError("participant_id is required when stream='per-track'")
    url = _build_url(gateway_url, room_id, token, stream, participant_id)
    async with connect(url) as ws:
        room = Room(ws)
        room._start()
        try:
            yield room
        finally:
            await room.close()


__all__ = ["Room", "join"]
