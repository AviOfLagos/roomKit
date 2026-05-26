# Issue Queue

Local queue of issues ready to file as GitHub issues once the repo is pushed.
Bulk-file with:

```bash
gh issue create --title "<title>" --body-file <(printf "...") --label "<labels>"
```

Or run the helper at the bottom of this file.

---

## P0 — blockers for first usable release

### `inactivity: auto-close idle rooms with 1-minute warning modal`
- **labels**: `enhancement`, `gateway`, `web`, `agent`
- **why**: every user-facing call platform closes idle rooms. Without this, abandoned tabs hold gateway resources and LiveKit minutes.
- **what**:
  - Gateway: in-memory `lastActivityMs` per room, 10s ticker. At 120 s of no activity → broadcast `{type:'room.inactivity.warning', closesInMs:60000}` on LiveKit data channel topic `roomkit_control`. At 180 s → `forceEndRoom` + DB `ended` + broadcast `room.closed`.
  - `POST /v1/rooms/:id/heartbeat` and `POST /v1/rooms/:id/extend` endpoints. Default agent + web client both call `/heartbeat` on human-speech-ended; web also bumps every 30 s while focused.
  - Web modal: appears on `room.inactivity.warning`, countdown timer, [Stay] resets activity, [Leave now] calls `DELETE /v1/rooms/:id`.
- **files**: `services/gateway/src/inactivity.ts` (new), `routes/rooms.ts`, `routes/webhooks.ts`, `server.ts`, `services/agent/agent.py`, `apps/web/src/components/InactivityModal.tsx` (new), `apps/web/src/components/RoomShell.tsx`.
- **acceptance**: idle room closes within 180 ± 10 s of last activity; "Stay" extends, "Leave now" closes immediately; constants overridable via env.

### `BYO bridge: end-to-end smoke test does not exist`
- **labels**: `bug`, `gateway`, `testing`
- **why**: the `/v1/rooms/:id/agent` WS path spawns `python3 src/gateway/livekit_bridge.py` but no automated test exercises it. `livekit-rtc` may not even be installed in fresh checkouts.
- **what**: add a smoke script that starts the gateway, mints a token, opens the WS, asserts a `room.joined` event arrives within 5 s. Document `pip install livekit livekit-rtc` in README prerequisites.
- **acceptance**: `pnpm smoke:bridge` returns 0 on a fresh clone after `pnpm install` + docker-compose up.

### `default agent: env-var failure mode is silent`
- **labels**: `bug`, `agent`
- **why**: if `OPENAI_API_KEY` / `DEEPGRAM_API_KEY` / `ELEVENLABS_API_KEY` are missing, the agent crashes silently inside `livekit-agents` and the room appears live with no audio.
- **what**: add a startup probe that prints required-vs-missing env vars and exits 1 with a clear message before joining a room.
- **acceptance**: starting the agent with one missing key produces a single-line error naming the key, before any room is touched.

## P1 — productionization

### `recording: signed-URL helper for MinIO/S3`
- **labels**: `enhancement`, `gateway`
- **why**: `GET /v1/rooms/:id/recording` currently returns the raw `s3://bucket/key` URL with a TODO. Consumers can't open it.
- **what**: implement S3 v4 presign (via `node:crypto`, no new deps) and return a `?X-Amz-...` URL with 15-min TTL.
- **acceptance**: returned URL plays back the MP4 in browser for 15 minutes, then 403s.

### `webhooks: verify LiveKit signature properly`
- **labels**: `security`, `gateway`
- **why**: `routes/webhooks.ts` allows `Authorization: bypass` for testing. Remove or gate behind env.
- **what**: drop the bypass branch in production builds (or gate with `process.env.NODE_ENV !== 'production'`).
- **acceptance**: production builds 401 the bypass header.

### `gateway: existing typecheck errors in ws-bridge.ts and rooms.ts`
- **labels**: `bug`, `gateway`, `typescript`
- **why**: `tsc --noEmit` fails with: missing `SocketStream` export, implicit-any on `(message, isBinary)` callbacks, bigint-times-number in `routes/rooms.ts:92`.
- **what**: switch to the `WebSocket` import from `@fastify/websocket` v10+, type the message callbacks, cast `joinedAt` to `Number()` before multiplying.
- **acceptance**: `pnpm --filter @roomkit/gateway exec tsc --noEmit` returns 0.

### `supervisor: emit a real RoomEvent variant, not `error` overloaded`
- **labels**: `enhancement`, `contract`
- **why**: the supervisor currently uses `{type:'error', code:'bridge.restarted', recoverable:true}`. Mixing transport restart signals with content errors is confusing.
- **what**: add `bridge.restarted` and `bridge.exhausted` variants to `packages/shared/src/events.ts` (additive — does not break wire contract). Bump RoomEvent union; mirror in Python `events.py`.
- **acceptance**: SDK consumers can `events.on('bridge.restarted', ...)` distinctly from `events.on('error', ...)`.

### `tenant story: API-key creation flow + UI`
- **labels**: `enhancement`, `gateway`
- **why**: only the seeded `dev` key exists. Multi-tenant scaffold is half-built.
- **what**: admin endpoints `POST /v1/tenants` + `POST /v1/tenants/:id/api-keys`. Web admin page (gated by a master key) to create + revoke.
- **acceptance**: a new tenant can be provisioned and call `POST /v1/rooms` end-to-end without touching the DB.

## P1 — DX + polish

### `web client: landing page is functional but ugly`
- **labels**: `design`, `web`
- **what**: replace `apps/web/src/app/page.tsx` with a designed landing page: hero, three feature columns, code-tab snippet, "Try in 30 s" CTA, contributors / GitHub link.
- **acceptance**: lighthouse mobile score ≥ 90; first paint ≤ 1.5 s on local dev.

### `docs: contributor guide`
- **labels**: `docs`
- **what**: `CONTRIBUTING.md` with: branch convention (`lane/*` for big features, `feat/*` for normal PRs), wire-contract rule, test commands per package, swarm pattern reference.
- **acceptance**: a new contributor can clone, run tests, open a PR without asking on Slack.

### `examples: real BYO agent with LLM (not just echo)`
- **labels**: `docs`, `examples`
- **what**: `examples/llm-agent.py` — uses `callplatform` SDK + OpenAI streaming + ElevenLabs TTS to actually hold a conversation. Demonstrates `recv() → STT → LLM → TTS → send()` loop end-to-end.
- **acceptance**: runnable with `OPENAI_API_KEY` set against a local room.

## P2 — research / nice-to-have

### `per-track: ship demo of a diarization agent that subscribes to N speakers`
- **labels**: `examples`, `enhancement`
- **what**: example that opens one WS per participant via `?stream=per-track`, runs Whisper per-stream, emits speaker-tagged transcripts.

### `sip ingress for vapi/bland integration`
- **labels**: `enhancement`, `research`
- **why**: feasibility doc §10 phase-4+ — optional for v1, but a SIP-to-WS adapter would let phone calls hit the same BYO surface.

### `self-host SFU option`
- **labels**: `infra`, `research`
- **why**: feasibility doc §10 — LiveKit cloud cost cap. Document switching `LIVEKIT_URL` to a self-hosted instance.

### `caveman: drop the lane/* worktree references from SWARM.md`
- **labels**: `docs`, `tech-debt`
- **why**: SWARM.md still references sibling-worktree pattern in the Rules section even though wave-A/B used the main-thread-commit pattern.

---

## Bulk-file helper

Once the GH repo exists and `gh auth status` is green, run:

```bash
gh issue create -t "Auto-close idle rooms with 1-min warning modal"        -l enhancement,gateway,web,agent -b "$(awk '/^### .inactivity:/,/^### /' ISSUES.md | head -n -1)"
gh issue create -t "BYO bridge end-to-end smoke test"                       -l bug,gateway,testing            -b "$(awk '/^### .BYO bridge/,/^### /' ISSUES.md | head -n -1)"
gh issue create -t "Default agent: env-var failure mode is silent"          -l bug,agent                      -b "$(awk '/^### .default agent/,/^### /' ISSUES.md | head -n -1)"
gh issue create -t "Recording: signed-URL helper for MinIO/S3"              -l enhancement,gateway            -b "$(awk '/^### .recording:/,/^### /' ISSUES.md | head -n -1)"
gh issue create -t "Webhooks: verify LiveKit signature properly"            -l security,gateway               -b "$(awk '/^### .webhooks:/,/^### /' ISSUES.md | head -n -1)"
gh issue create -t "Gateway: existing typecheck errors in ws-bridge/rooms"  -l bug,gateway,typescript         -b "$(awk '/^### .gateway:/,/^### /' ISSUES.md | head -n -1)"
gh issue create -t "Supervisor: emit a real RoomEvent variant"              -l enhancement,contract           -b "$(awk '/^### .supervisor:/,/^### /' ISSUES.md | head -n -1)"
gh issue create -t "Tenant: API-key creation flow + admin UI"               -l enhancement,gateway            -b "$(awk '/^### .tenant story:/,/^### /' ISSUES.md | head -n -1)"
gh issue create -t "Web client: redesigned landing page"                    -l design,web                     -b "$(awk '/^### .web client:/,/^### /' ISSUES.md | head -n -1)"
gh issue create -t "Docs: contributor guide"                                -l docs                           -b "$(awk '/^### .docs:/,/^### /' ISSUES.md | head -n -1)"
gh issue create -t "Examples: real BYO agent with LLM"                      -l docs,examples                  -b "$(awk '/^### .examples:/,/^### /' ISSUES.md | head -n -1)"
gh issue create -t "Per-track diarization demo"                             -l examples,enhancement           -b "$(awk '/^### .per-track:/,/^### /' ISSUES.md | head -n -1)"
gh issue create -t "SIP ingress for Vapi/Bland integration"                 -l enhancement,research           -b "$(awk '/^### .sip ingress/,/^### /' ISSUES.md | head -n -1)"
gh issue create -t "Self-host SFU option doc"                               -l infra,research                 -b "$(awk '/^### .self-host SFU/,/^### /' ISSUES.md | head -n -1)"
gh issue create -t "SWARM.md: clean up obsolete worktree references"        -l docs,tech-debt                 -b "$(awk '/^### .caveman:/,/^### /' ISSUES.md | head -n -1)"
```

(Each `awk` pulls the relevant section out of this file as the body.)
