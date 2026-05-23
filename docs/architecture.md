# Architecture

```
                          ┌──────────────────────┐
                          │  Web client (Next.js) │  ← humans
                          │  apps/web             │
                          └──────────┬───────────┘
                                     │ LiveKit WebRTC
                                     ▼
   ┌────────────────────┐   ┌────────────────────┐   ┌──────────────────────┐
   │ Default voice agent │   │  LiveKit SFU       │   │  PostgreSQL          │
   │ services/agent      │◄──┤  (Cloud or self-   │   │  rooms, recordings,  │
   │ (Silero VAD,        │   │   hosted, Apache 2)│   │  transcripts, summaries│
   │  Deepgram, GPT-4o,  │   │                    │   │  tenants, api_keys   │
   │  ElevenLabs)        │   └────────┬───────────┘   └──────────┬───────────┘
   └─────────────────────┘            │                          │
                                      │ WebRTC tracks            │
                                      ▼                          │
                          ┌──────────────────────────┐           │
                          │  Gateway (Fastify, TS)   │◄──────────┘
                          │  services/gateway        │
                          │  - REST /v1/rooms/*      │
                          │  - WS  /v1/rooms/:id/agent│
                          │  - LiveKit Egress (MP4)  │
                          │  - Dual JWT mint         │
                          └────────┬─────────────────┘
                                   │ raw PCM 16k mono 20ms (640 B)
                                   ▼
                       ┌───────────────────────────┐
                       │  BYO agent (Python / TS)   │
                       │  packages/sim-sdk-py       │
                       │  packages/sdk              │
                       │   join() / recv() / send() │
                       └───────────────────────────┘
```

## Layers

| Layer       | Role                                              | Files                                |
|-------------|---------------------------------------------------|--------------------------------------|
| SFU         | WebRTC media (jitter, ICE, codec, TURN)           | LiveKit (external)                   |
| Gateway     | Auth, REST, WS bridge, egress orchestration       | `services/gateway/`                  |
| Default AI  | Hosted voice agent (VAD/STT/LLM/TTS pipeline)     | `services/agent/`                    |
| BYO SDK     | Opaque PCM stream + JSON events, transport-hidden | `packages/sdk/`, `packages/sim-sdk-py/` |
| Shared      | Frozen wire contract + RoomEvent types            | `packages/shared/src/{wire,events}.ts` |
| Web client  | White-label human-join UI                         | `apps/web/`                          |
| Infra       | Docker compose (Postgres, MinIO, LiveKit)         | `infra/`                             |

## Data flow — BYO agent join

1. Tenant calls `POST /v1/rooms` → gets `roomId` + `agentToken` (legacy).
2. Tenant calls `POST /v1/rooms/:id/tokens/sign` `{role:'agent',identity:'bot'}` → gets `{gatewayToken, livekitToken, expiresAt}`.
3. BYO agent opens WebSocket to `/v1/rooms/:id/agent?token=<gatewayToken>&stream=mixed`.
4. Gateway verifies JWT, spawns `livekit_bridge.py` subprocess which joins LiveKit as a participant.
5. Bridge subscribes to all remote audio tracks, downmixes + resamples 48k→16k, pushes 640 B frames to client WS.
6. Client SDK reads `recv()`, processes, pushes 640 B frames via `send()`. Bridge resamples 16k→48k and publishes back to LiveKit.
7. JSON events flow on the same socket (text frames): `room.joined`, `speech.started/ended`, `transcript.*`, `chat.message`, `recording.*`, `error`.

## Why this shape

- Gateway = external contract. LiveKit = internal swappable transport. See `docs/call-platform-feasibility.md` §2-§3.
- SDK is opaque to WebRTC. Builders write ~10 lines of Python or TS. Mock with `SimulatedRoom` for CI.
- Multi-tenant scaffold: every `api_keys` row links to a `tenants` row; `rooms` carry `tenant_id`. Token mint enforces isolation.
- Recording = LiveKit Egress → MinIO/S3 → `recordings` table. URL returned via existing `GET /v1/rooms/:id/recording`.
