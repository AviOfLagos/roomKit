# SDK Quickstart

roomKit ships two BYO SDKs that speak the same wire contract:

- **Python** — `callplatform` in `packages/sim-sdk-py/`
- **Node / TS** — `@roomkit/sdk` in `packages/sdk/`

Both expose the same primitives:

| Primitive    | Returns / Takes                         |
|--------------|-----------------------------------------|
| `recv()`     | next 640-byte 20 ms frame from the room |
| `send(buf)`  | push a 640-byte 20 ms frame             |
| `events`     | async iterator / EventEmitter of `RoomEvent` |
| `close()`    | tear down the connection                |

The wire contract is frozen in `packages/shared/src/wire.ts` (TS) and mirrored in `packages/sim-sdk-py/src/callplatform/wire.py` (Py): 16 kHz mono PCM Int16 LE, 20 ms frames = 320 samples = **640 bytes**, JSON control on the same WebSocket.

## 1. Mint a gateway token

```bash
curl -X POST -H x-api-key:dev -H content-type:application/json \
  -d '{"role":"agent","identity":"echo-bot"}' \
  http://localhost:3000/v1/rooms/$RID/tokens/sign
# → { "gatewayToken": "...", "livekitToken": "...", "expiresAt": "..." }
```

Use `gatewayToken` for the SDK. Use `livekitToken` for the LiveKit JS / web client.

## 2. Python (real gateway)

```python
import asyncio
from callplatform import join

async def main():
    async with join(room="room-abc", token="GATEWAY_TOKEN", url="ws://localhost:3000") as call:
        async for ev in call.events():
            if ev["type"] == "speech.ended":
                audio = await call.recv()
                await call.send(audio)  # echo back

asyncio.run(main())
```

## 3. Python (deterministic sim, no network)

```python
import asyncio
from callplatform.sim import SimulatedRoom, silence_frame

async def main():
    script = [
        {"event": {"type": "room.joined", "participantId": "a", "role": "agent", "at": 0}},
        {"event": {"type": "speech.ended", "participantId": "h", "at": 10}},
        {"frame": silence_frame()},
    ]
    async with SimulatedRoom(script=script) as call:
        async for ev in call.events():
            if ev["type"] == "speech.ended":
                frame = await call.recv()
                assert len(frame) == 640
                break

asyncio.run(main())
```

## 4. Node (real gateway)

```ts
import { join } from '@roomkit/sdk';

const call = await join({ url: 'ws://localhost:3000', room: 'room-abc', token: 'GATEWAY_TOKEN' });
call.events.on('event', async (ev) => {
  if (ev.type === 'speech.ended') {
    const audio = await call.recv();
    call.send(audio);
  }
});
```

## 5. Node (deterministic sim)

```ts
import { createSimulatedRoom } from '@roomkit/sdk';

const call = createSimulatedRoom({
  script: [
    { event: { type: 'room.joined', participantId: 'a', role: 'agent', at: 0 } },
    { event: { type: 'speech.ended', participantId: 'h', at: 10 } },
    { frame: Buffer.alloc(640) },
  ],
});
```

## Stream modes

The agent WebSocket accepts `?stream=mixed` (default — one downmix) or `?stream=per-track` (one stream per remote speaker; planned in wave-B). Pass via:

```python
join(room=..., token=..., stream="per-track")
```

```ts
join({ url, room, token, stream: 'per-track' });
```

## Event shapes

All events are JSON text frames on the same WebSocket. Defined in `packages/shared/src/events.ts` and mirrored as Python TypedDicts in `callplatform.events`.

See `docs/call-platform-feasibility.md` §5 for the full list.
