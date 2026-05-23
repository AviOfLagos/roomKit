# Lane L2 — `@roomkit/sdk` report

## Files added

```
packages/sdk/README.md                # 10-line usage example (real + sim)
packages/sdk/package.json             # name=@roomkit/sdk, type=module, deps: @roomkit/shared workspace:*, ws ^8
packages/sdk/tsconfig.json            # ES2022 / NodeNext / strict / outDir dist / rootDir src
packages/sdk/src/ambient.d.ts         # minimal pre-install ambient: node:events, ws, Buffer, queueMicrotask, setImmediate
packages/sdk/src/index.ts             # exports join, createSimulatedRoom, Call, JoinOptions, RoomEvent, AUDIO, ENDPOINTS
packages/sdk/src/types.ts             # Call interface, JoinOptions, SimulatedRoomOptions, re-exports wire + events
packages/sdk/src/join.ts              # real WS client built on `ws` ^8
packages/sdk/src/sim.ts               # in-process deterministic SimulatedRoom (no network, no `ws` runtime)
packages/sdk/test/contract.test.mjs   # node:test — sim event ordering, recv() frame, send() validation, close() reject
packages/sdk/LANE_REPORT.md           # this file
```

## tsc command

From `packages/sdk/`:

```
npx -y -p typescript@5.4.5 tsc
```

Expected result: 0 errors. Emits `packages/sdk/dist/{index,join,sim,types}.{js,d.ts}`.

NOTE for orchestrator: this lane's sandbox blocked execution of `node`,
`npm`, `npx`, and `tsc`, so I could not run the toolchain end-to-end
inside the lane. Source was hand-validated against the frozen shared
contract under `packages/shared/dist/` and the TS 5.4.5 NodeNext type
resolution model. Wire constants are imported via the relative path
`../../shared/dist/wire.js` exactly as the acceptance spec requires
(so the build works without a pnpm-linked workspace).

## `node --test test/contract.test.mjs` — expected output

Four tests, all green:

```
TAP version 13
# Subtest: wire contract: AUDIO.bytesPerFrame === 640
ok 1 - wire contract: AUDIO.bytesPerFrame === 640
# Subtest: SimulatedRoom replays scripted events then yields a 640-byte frame
ok 2 - SimulatedRoom replays scripted events then yields a 640-byte frame
# Subtest: SimulatedRoom.send accepts 640-byte frame and rejects bad sizes
ok 3 - SimulatedRoom.send accepts 640-byte frame and rejects bad sizes
# Subtest: SimulatedRoom recv() after close rejects
ok 4 - SimulatedRoom recv() after close rejects
1..4
# tests 4
# pass 4
# fail 0
```

## API surface

`@roomkit/sdk` ships a single `Call` shape — `{ recv(): Promise<Buffer>;
send(Buffer): void; events: EventEmitter; close(): void }` — returned
identically by both `join({ url, room, token, stream? })` (real WS
gateway client built on `ws` ^8: binary frames = audio, text frames
parsed as `RoomEvent` JSON, both pushed onto a normal Node
`EventEmitter`) and `createSimulatedRoom({ script })` (in-process
deterministic fake with no network and no `ws` runtime). Both surfaces
import frame sizing straight from the FROZEN `@roomkit/shared/wire`
contract (640-byte 20 ms 16 kHz mono Int16 LE frames) and validate it
on every `send()`. The sim replays a scripted sequence of `RoomEvent`s
and pre-supplied frames in order, scheduling each step on its own
`setImmediate` tick so awaiting `events.once(...)` consumers can
re-subscribe between steps without missing emissions — giving builders
a deterministic, network-free path to write and CI-test agent logic
before pointing the same code at a live gateway.
