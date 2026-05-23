"""End-to-end exercise of ``SimulatedRoom`` with zero network."""

from __future__ import annotations

import asyncio

import pytest

from callplatform import AUDIO
from callplatform.sim import SimulatedRoom, silence_frame
from callplatform.sim.runtime import join as sim_join


def _frame(byte: int = 0) -> bytes:
    return bytes([byte & 0xFF]) * AUDIO["bytesPerFrame"]


async def test_sim_yields_joined_then_speech_ended_with_frame() -> None:
    """Acceptance: room.joined first, then speech.ended; recv() returns a 640-byte frame."""

    async with SimulatedRoom() as room:
        room.script_event(
            {"type": "room.joined", "participantId": "agent-1", "role": "agent", "at": 1}
        )
        room.script_event(
            {"type": "speech.ended", "participantId": "human-2", "at": 2}
        )
        room.script_audio(silence_frame())
        room.finish()

        seen_types: list[str] = []
        frame_after_speech: bytes | None = None

        async for ev in room.events():
            seen_types.append(ev["type"])
            if ev["type"] == "speech.ended":
                frame_after_speech = await room.recv()

        assert seen_types == ["room.joined", "speech.ended"]
        assert frame_after_speech is not None
        assert len(frame_after_speech) == 640
        assert len(frame_after_speech) == AUDIO["bytesPerFrame"]


async def test_sim_send_records_outbound_audio() -> None:
    async with SimulatedRoom() as room:
        await room.send(_frame(1))
        await room.send(_frame(2))
        assert room.sent_audio == [_frame(1), _frame(2)]


async def test_sim_send_rejects_off_size_frame() -> None:
    async with SimulatedRoom() as room:
        with pytest.raises(ValueError):
            await room.send(b"\x00" * 641)
        with pytest.raises(ValueError):
            await room.send(b"")


async def test_sim_script_rejects_unknown_event_type() -> None:
    room = SimulatedRoom()
    with pytest.raises(ValueError):
        room.script_event({"type": "totally.fake", "at": 0})
    await room.close()


async def test_sim_script_rejects_off_size_audio() -> None:
    room = SimulatedRoom()
    with pytest.raises(ValueError):
        room.script_audio(b"\x00" * 320)
    await room.close()


async def test_sim_send_event_records_outbound_events() -> None:
    async with SimulatedRoom() as room:
        await room.send_event(
            {"type": "chat.message", "participantId": "agent-1", "text": "hi", "at": 5}
        )
        assert room.sent_events == [
            {"type": "chat.message", "participantId": "agent-1", "text": "hi", "at": 5}
        ]


async def test_sim_join_helper_yields_room() -> None:
    """``sim.runtime.join`` mirrors the real ``callplatform.join`` API surface."""
    pre = SimulatedRoom()
    pre.script_event({"type": "room.joined", "participantId": "a", "role": "agent", "at": 1})
    pre.finish()
    async with sim_join(room=pre) as room:
        evs = [ev async for ev in room.events()]
        assert [ev["type"] for ev in evs] == ["room.joined"]


async def test_sim_recv_returns_empty_after_finish_drained() -> None:
    async with SimulatedRoom() as room:
        room.script_audio(silence_frame())
        room.finish()
        first = await room.recv()
        second = await asyncio.wait_for(room.recv(), timeout=1.0)
        assert len(first) == 640
        assert second == b""


async def test_sim_no_network_used() -> None:
    """Guarantee the sim runtime never opens a socket.

    Monkey-patches ``socket.socket`` to raise so any accidental network call
    explodes loudly. Importantly the entire scripted flow stays clean.
    """
    import socket

    original = socket.socket

    def _boom(*a, **kw):
        raise AssertionError("SimulatedRoom must not open sockets")

    socket.socket = _boom  # type: ignore[assignment]
    try:
        async with SimulatedRoom() as room:
            room.script_event(
                {"type": "room.joined", "participantId": "a", "role": "agent", "at": 1}
            )
            room.script_audio(silence_frame())
            room.finish()
            evs = [ev async for ev in room.events()]
            pcm = await room.recv()
        assert [ev["type"] for ev in evs] == ["room.joined"]
        assert len(pcm) == 640
    finally:
        socket.socket = original  # type: ignore[assignment]
