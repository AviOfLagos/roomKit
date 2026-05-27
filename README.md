# roomKit

**Standalone WebRTC + AI call platform.** Build voice/video rooms with humans, the bundled context-aware AI host, and any number of custom AI agents — joined through one 10-line SDK or a raw 640-byte PCM WebSocket. LiveKit under the hood; your code never touches WebRTC.

[![live demo](https://img.shields.io/badge/live-roomkit--omega.vercel.app-22d3ee)](https://roomkit-omega.vercel.app) [![status: alpha](https://img.shields.io/badge/status-alpha-orange)](#status) [![license: Apache 2.0](https://img.shields.io/badge/license-Apache_2.0-blue)](LICENSE) [![docs](https://img.shields.io/badge/docs-architecture-purple)](docs/architecture.md)

**Live landing page:** https://roomkit-omega.vercel.app
**Deploy your own copy:** [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/AviOfLagos/roomKit&root-directory=apps/web&project-name=roomkit&repository-name=roomKit)

---

## Why

If you are building a voice agent (Vapi/Retell-style), a meeting-bot, a transcription tool, or a multi-agent collaboration product, you usually have to:

- Run an SFU.
- Wrestle WebRTC (ICE, codec, jitter, TURN).
- Handle JWT auth, multi-tenancy, recording, transcripts, summaries.
- Build a web UI for humans.
- Ship an SDK for your own agents.

roomKit gives you all of that behind a single REST API + a single WebSocket frame contract. Mock your agent against `SimulatedRoom` in CI; ship to production by changing one URL.

## Features

- **Frozen wire contract** — 16 kHz mono PCM Int16 LE, 20 ms (640-byte) binary frames + JSON control sidechannel on the same socket. Defined in `packages/shared/src/wire.ts`, mirrored byte-for-byte in every SDK.
- **Bundled default AI agent** — Silero VAD, Deepgram STT, OpenAI GPT-4o-mini, ElevenLabs TTS. Drop a `systemPrompt` in room metadata, the agent joins, greets, and transcribes.
- **BYO agent SDKs** — `callplatform` (Python) and `@roomkit/sdk` (Node/TS). Both expose `recv() / send() / events()` and ship a deterministic `SimulatedRoom` for unit tests.
- **`mixed` and `per-track` streaming** — get a single downmix, or pin the audio stream to one specific participant for diarization-aware agents.
- **Server-side recording** — LiveKit Egress → MinIO/S3, MP4 composite, surfaced via REST.
- **Multi-tenant scaffold** — `tenants` table, API-key → tenant binding, dual-token mint (gateway JWT + LiveKit access token) at `POST /v1/rooms/:id/tokens/sign`.
- **Supervised audio bridge** — bounded-restart Python subprocess wrapper. On crash, the bridge respawns and emits `error{code:'bridge.restarted', recoverable:true}` so the SDK can keep going.
- **White-label web client** — Next.js + LiveKit React: landing page, room (video grid + chat + transcripts), ended/summary page.

## Architecture

```
Web client (Next.js) ──── WebRTC ──► LiveKit SFU ◄── WebRTC ──── Default AI agent (Python)
                                          │
                                  (server-side bridge)
                                          │
                                          ▼
                            Gateway (Fastify+TS)
                            REST /v1/rooms/*
                            WS  /v1/rooms/:id/agent
                                          │
                              raw 16k mono PCM 20 ms
                                          │
                                          ▼
                            BYO agent (Python or Node)
                            join() / recv() / send() / events()
```

Full diagram and layer table in [`docs/architecture.md`](docs/architecture.md).

## 5-minute quickstart

### Prerequisites

- Node ≥ 22, PNPM, Docker + docker-compose, Python 3.11.

### Boot

```bash
docker-compose -f infra/docker-compose.yml up -d   # Postgres + MinIO + LiveKit
pnpm install
pnpm --filter @roomkit/shared build                # build the shared wire contract first
pnpm dev                                           # gateway :3000  ·  web :3001
```

Drop a `.env` in `services/gateway/` (see "Environment" below) before `pnpm dev`.

### Create + join a room

```bash
RID=$(curl -s -X POST -H x-api-key:dev -H content-type:application/json \
  -d '{"context":{"systemPrompt":"You are a friendly meeting host."},"defaultAgent":true}' \
  http://localhost:3000/v1/rooms | jq -r .roomId)

open "http://localhost:3001/room/$RID"
```

### BYO agent — Python

```python
import asyncio
from callplatform import join

async def main():
    async with join(room_id="room-abc", token="GATEWAY_TOKEN",
                    gateway_url="ws://localhost:3000") as call:
        async for ev in call.events():
            if ev["type"] == "speech.ended":
                audio = await call.recv()
                await call.send(audio)  # echo back

asyncio.run(main())
```

### BYO agent — Node / TS

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

### Deterministic local sim (no network)

Both SDKs ship a `SimulatedRoom` with identical surface — same `recv() / send() / events()` — so you can unit-test agents offline. See [`docs/sdk-quickstart.md`](docs/sdk-quickstart.md) for the full mirror.

## REST API

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/rooms` | Create a room |
| GET | `/v1/rooms/:id` | Room state + live participants |
| DELETE | `/v1/rooms/:id` | Force-end a room |
| POST | `/v1/rooms/:id/tokens` | Mint a LiveKit token (legacy) |
| POST | `/v1/rooms/:id/tokens/sign` | Mint a dual `{gatewayToken, livekitToken}` (tenant-scoped) |
| POST | `/v1/rooms/:id/recording/start` | Start LiveKit Egress composite recording |
| POST | `/v1/rooms/:id/recording/stop` | Stop recording + persist duration |
| GET | `/v1/rooms/:id/recording` | Latest recording URL |
| GET | `/v1/rooms/:id/transcript` | All speaker-tagged chunks |
| GET | `/v1/rooms/:id/summary` | AI-generated meeting summary |
| GET | `/v1/tenants/me` | Tenant metadata for the calling API key |
| POST | `/v1/webhooks/livekit` | LiveKit webhook ingress |

All REST endpoints require `x-api-key`. Default dev key is `dev` (seeded into Postgres on first boot).

## BYO WebSocket gateway

```
ws://<host>/v1/rooms/:id/agent?token=<gatewayToken>&stream=mixed
ws://<host>/v1/rooms/:id/agent?token=<gatewayToken>&stream=per-track&participantId=<id>
```

- Binary frame = audio. Length must be a positive multiple of 640 bytes. Sample format: 16 kHz mono Int16 LE, 20 ms = 320 samples = 640 bytes.
- Text frame = JSON `RoomEvent` (see `packages/shared/src/events.ts`).
- `stream=mixed` (default) gives you the downmixed room audio. `stream=per-track` pins audio to one participant — useful for diarization-aware agents that join one stream per speaker.

## Environment

```ini
PORT=3000
ROOMKIT_API_KEY=dev
LIVEKIT_URL=http://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
DATABASE_URL=postgres://postgres:postgres@localhost:5432/roomkit
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=admin12345
MINIO_BUCKET=roomkit-recordings
NEXT_PUBLIC_GATEWAY_URL=http://localhost:3000
NEXT_PUBLIC_LIVEKIT_URL=ws://localhost:7880

# Default agent (only required if defaultAgent=true)
OPENAI_API_KEY=...
DEEPGRAM_API_KEY=...
ELEVENLABS_API_KEY=...
```

## Repository layout

```
apps/web/              Next.js 14 white-label web client
services/gateway/      Fastify+TS REST + WS bridge + LiveKit Egress + supervisor
services/agent/        Default Python livekit-agents voice host
packages/shared/       Frozen wire contract + RoomEvent types
packages/sdk/          @roomkit/sdk — Node BYO SDK + SimulatedRoom
packages/sim-sdk-py/   callplatform — Python BYO SDK + SimulatedRoom
infra/                 docker-compose (Postgres + MinIO + LiveKit)
docs/                  architecture, SDK quickstart, feasibility study
```

## Status

Alpha. Wave-A and wave-B feature lanes shipped; see `SWARM.md` for the parallel-build history and `docs/call-platform-feasibility.md` for the design study. Next up: inactivity auto-close, landing/marketing, an Egress signed-URL helper, and a deployable production reference stack. Track open work in [GitHub Issues](../../issues) once the project is pushed.

## Contributing

```bash
git clone <repo>
cd roomKit
pnpm install
pnpm --filter @roomkit/shared build
pnpm --filter @roomkit/shared test     # 9/9 wire-contract tests
cd packages/sdk && node --test test/   # 4/4 Node sim tests
cd ../sim-sdk-py && python3 -m venv .venv && source .venv/bin/activate
pip install -e . pytest pytest-asyncio websockets
PYTHONPATH=src pytest -q --asyncio-mode=auto  # 17/17 Python sim tests
```

Open a PR against a `feat/*` branch. Keep the wire contract frozen — any change to `packages/shared/src/wire.ts` requires bumping `WIRE_VERSION` and coordinating with every SDK and the gateway.

## License

Apache 2.0 — see [LICENSE](LICENSE).
