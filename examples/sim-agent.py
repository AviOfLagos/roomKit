"""
Deterministic local test of a BYO agent against the in-process SimulatedRoom.
No network, no LiveKit, no gateway. Useful for CI + offline dev.

Run:
    python3 examples/sim-agent.py
"""

import asyncio

from callplatform import AUDIO
from callplatform.sim import SimulatedRoom, silence_frame


async def main() -> None:
    script = [
        {"event": {"type": "room.joined", "participantId": "agent-sim", "role": "agent", "at": 0}},
        {"event": {"type": "speech.ended", "participantId": "human-1", "at": 100}},
        {"frame": silence_frame()},
    ]
    async with SimulatedRoom(script=script) as call:
        async for event in call.events():
            print(f"[event] {event['type']}")
            if event["type"] == "speech.ended":
                audio = await call.recv()
                assert len(audio) == AUDIO["bytes_per_frame"]
                print(f"  echoed {len(audio)} bytes")
                break


if __name__ == "__main__":
    asyncio.run(main())
