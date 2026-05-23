"""
roomKit BYO-agent example using the `callplatform` Python SDK.

Echoes mixed remote audio back into the room after each utterance and prints
every control event. ~10 functional lines on the SDK surface.

Run:
    python3 examples/byo-agent.py <roomId> <gatewayToken>

The gateway token comes from
    POST /v1/rooms/<roomId>/tokens/sign
    body: {"role":"agent","identity":"echo-bot"}
"""

import asyncio
import sys

from callplatform import join


async def run(room_id: str, token: str) -> None:
    async with join(room=room_id, token=token, url="ws://localhost:3000") as call:
        async for event in call.events():
            print(f"[event] {event['type']}")
            if event["type"] == "speech.ended":
                audio = await call.recv()
                await call.send(audio)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python examples/byo-agent.py <roomId> <gatewayToken>")
        sys.exit(1)
    asyncio.run(run(sys.argv[1], sys.argv[2]))
