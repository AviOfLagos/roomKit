# Call Platform — Standalone Product Feasibility

**Status:** Findings (proposed, not yet adopted) · **Date:** 2026-05-21 · **Sources:** Rex consult 2026-05-21 + stack research + current `services/meeting-runtime` audit.

§B — TL;DR
- Build standalone call platform. **Yes — feasible & smart.** ~55% of existing `services/meeting-runtime` already platform-reusable.
- **Internal SFU:** LiveKit (Apache 2.0). Don't expose LiveKit SDK to external AI builders.
- **External AI-join method:** ONE method — **WebSocket gateway, 16 kHz mono PCM Int16 LE, 20 ms (640-byte) frames + JSON control sidechannel**. Identical to existing `audio-pipe.md` v0.1.0 contract → MeetMind drops in untouched.
- **MeetMind integration:** add `kind: 'platform'` to existing `MeetingRuntime` factory. Daniel/Nova/Maya/Iris see zero change. Contract bump → `meet-session.md` v0.3.0 (additive).
- **Builder experience:** ~10 lines Python. `join() → recv() / send(bytes) / events()`. Audio is opaque PCM; WebRTC hidden.
- Phased: gateway + WS + sim SDK (4wk) → per-track + browser client (4wk) → recording + tenant auth (4wk).

---

## §1 Scope of standalone product

**Working name:** `call-platform` (defer final naming).

**What it is:**
- Hosted SFU + room API. Anyone signs up, mints rooms, shares join links.
- 5–10 participants per room. Humans + AI agents indistinguishable in seat count.
- Built-in: server-side recording, speaker-tagged transcript, in-call chat (data channel), mic/cam/screen.
- Public web client (white-label) for humans joining via link.
- Public **AI-builder SDK** (Python + Node) — 10 lines to join + stream audio.

**What MeetMind becomes:** one consumer of the platform. Nova/Daniel/Maya/Iris all keep their current contracts. Only Rex's runtime gains a new `kind`.

**Why standalone, not internal-only:**
- `vision.md` already says *"reusable SDK for autonomous AI meeting agents"*. Standalone = direct fit, not a stretch.
- Decouples MeetMind from infra risk (LiveKit upgrades, anti-bot, etc. become platform problems).
- Possible business surface: sell to other AI builders (Vapi/Retell competitors). Optional.
- Open-source the public SDK, keep SFU layer proprietary — standard play.

---

## §2 Build vs buy

V1: do not reinvent the SFU. Wrap LiveKit.
- Reasons: LiveKit is Apache 2.0, self-hostable, handles ICE/TURN/codec/jitter natively, has 2026 turn-detector + barge-in classifier (v1.5).
- Reinventing mediasoup: 6–12 months. Kills MVP.

V2: do reinvent **the AI-join API surface**.
- Reason: if we expose LiveKit SDK to external builders, we are married to LiveKit forever. If we expose our own WS gateway, we can swap LiveKit→mediasoup/Janus later without breaking integrators.
- The gateway is ~1 week of Go/Python. Already prototyped in `services/meeting-runtime/src/audio/bridge.ts` (localhost variant).

∴ **LiveKit = internal transport (hidden). Our WS gateway = external contract (stable).**

---

## §3 External AI-join method — pick ONE

Rex's call: **WebSocket gateway, 16 kHz mono PCM Int16 LE, 20 ms frames (640 bytes), bidirectional. JSON control sidechannel on same socket.**

Comparison:

| Method | Builder lift | Latency floor | Match our contract? | Verdict |
|---|---|---|---|---|
| WebRTC peer (LiveKit SDK) | Heavy: ICE, codec, JWT, datachannel | ~50ms | No — `RTCTrack` ≠ `Readable` | Reject — couples us forever |
| SIP gateway | Phone-call shape, telco | ~150–300ms jitter | Mostly (audio only) | Defer — useful for Vapi/Bland integration in v2 |
| **WS PCM 16k mono** | **~10 lines, any language** | **~20–40ms WS** | **Yes — already our spec** | **Adopt** |
| OpenAI-Realtime WS | Familiar API | Same as above | Adapter needed | Reject — protocol coupling |
| Multiple methods | Maintenance tax | — | — | Reject — no canonical path |

**Frame contract** (from existing `audio-pipe.md` v0.1.0, kept verbatim):
- 16 kHz, mono, Int16 LE
- 20 ms frame = 320 samples = 640 bytes
- WS binary frame = n × 640 bytes
- WS text frame = JSON control (events, transcript, chat, hangup)

**Endpoints (proposal):**
```
wss://platform/v1/rooms/:roomId/agent?token=<jwt>
  - binary frames (recv): mixed remote audio, 16k mono PCM, 20ms
  - binary frames (send): AI's outbound audio, same format
  - text frames: {type, ...}  — see §5
```

**Auth:** per-room JWT signed by tenant key. Issued via `POST /v1/rooms/:roomId/tokens` (Maya scope).

---

## §4 Data format alignment with current contract

`audio-pipe.md` v0.1.0 already matches what builders need. **Zero format change for MeetMind.**

Caveats (must address before GA):

| Caveat | Detail | Mitigation |
|---|---|---|
| WebRTC ingress is 48 kHz stereo float32 | Resample + downmix at SFU→WS edge | Polyphase resample (~sub-ms, ~2% core / participant). Budget it. |
| Multi-participant mixing | `/recv` today is single mono mixdown. Some AI flows need per-speaker stream (speaker diarization). | Query param `?stream=mixed\|per-track`. Ship `mixed` first. `per-track` is v0.2. |
| Frame alignment on join mid-stream | Resampler may emit non-640-multiple chunk on first window | Buffer + align before send. Gateway must enforce on egress (not just consumer). |
| Mono is canonical | Stereo not supported in audio-pipe | If anyone needs stereo, ship as 2 streams. Do NOT break frame contract. |

---

## §5 JSON control sidechannel (over same WS)

Discriminator: binary frame = audio, text frame = JSON event. One connection, two channels.

Event types (v1, additive):
```
{ type: 'room.joined',          participantId, role: 'agent'|'human', at }
{ type: 'participant.joined',   participantId, displayName, role, at }
{ type: 'participant.left',     participantId, reason, at }
{ type: 'speech.started',       participantId, at }       // platform-side VAD
{ type: 'speech.ended',         participantId, at }       // platform-side VAD
{ type: 'transcript.partial',   participantId, text, chunkId, at }
{ type: 'transcript.final',     participantId, text, chunkId, confidence?, at }
{ type: 'chat.message',         participantId, text, at }
{ type: 'recording.started',    egressId, at }
{ type: 'recording.stopped',    egressId, durationMs, at }
{ type: 'error',                code, message, recoverable }
```

Open question (decide pre-build): VAD platform-side vs builder-side?
- Rex argues **platform-side**: ~5 ms compute, removes biggest latency variance source for builders, consistent endpointing across integrations.
- Counter: some builders want their own VAD model. Solution: ship platform VAD by default, allow opt-out per token.

---

## §6 MeetMind integration — `MeetingRuntime` stays canonical

Decision: **Option (c) from consult** — `MeetingRuntime` SDK remains the canonical Node/Python consumer API. Platform is its transport layer.

Change set:
- Add `kind: 'platform'` to `MeetingRuntime` factory next to `'sim' | 'real'`.
- New impl: `createPlatformMeetingRuntime({ joinUrl, joinToken })` opens two WS to platform gateway, wraps in `Readable`/`Writable`. Mirrors `audio/bridge.ts`.
- `meet-session.md` bumped → **v0.3.0** (additive, no break). `MeetingRuntimeOptions` gains optional `platform: { joinUrl, joinToken }`.
- Daniel/Nova/Maya/Iris **see zero change**. Same contract.
- Supervisor (caveman bounded restart) wraps platform impl — reconnects hide WS drops from downstream. Preserves invariants I3 (stream survives reconnect) and I6 (mute persists).

Rejected alternatives:
- (a) Add `kind: 'platform'` and call it a day — same as (c) but undersold; (c) is honest framing.
- (b) Deprecate `MeetingRuntime` entirely → loses supervisor + mute invariant + reconnect hiding. ⊥

---

## §7 Module reuse map (from Rex audit)

| Module | Reusable for platform | Action |
|---|---|---|
| `src/audio/bridge.ts` | **90%** | Hoist to `@callplatform/wire` package. Strip localhost assumption. Add token auth. |
| `src/audio/inject.ts` | 0% | Drop — Meet-specific RTCPeerConnection hook. |
| `src/contracts.ts` | 70% | Fork. Types clean. `meet.*` codes → `call.*` in platform; MeetMind keeps `meet.*` shim. |
| `src/factory.ts` | 80% | Keep. Add `'platform'` kind. |
| `src/MeetingRuntime.ts` | 10% | MeetMind-only Playwright orchestrator. Stays. |
| `src/playwright/*` | 0% | Drop / archive per prior decision. |
| `src/sim/SimulatedMeetingRuntime.ts` | **100%** | Hoist to public dev SDK. Competitive feature — every builder runs sim before paying. |
| `src/supervisor/` (uses `@meetmind/caveman`) | **100%** | Bounded restart, transport-agnostic. Reusable. |

∴ ~55% reusable, ~35% Meet-specific (already isolated under `playwright/`), ~10% wiring needing one-line addition.

---

## §8 Public SDK surface — 10-line join experience

**Python (canonical):**
```python
from callplatform import join

async with join(room="r_abc", token="jwt_...") as call:
    async for event in call.events():
        if event.type == "speech.ended":
            audio = await call.recv()       # bytes: 16k mono int16 LE
            reply = my_llm_and_tts(audio)   # builder code
            await call.send(reply)          # same format back
```

**Node mirror (same shape, native streams):**
```ts
import { join } from '@callplatform/sdk';

const call = await join({ room: 'r_abc', token: 'jwt_...' });
call.events.on('speech.ended', async () => {
  const audio = await call.recv();        // Buffer, 16k mono int16 LE
  const reply = await myLlmAndTts(audio);
  await call.send(reply);
});
```

Primitives: `recv() → bytes` · `send(bytes)` · `events` (AsyncIterator | EventEmitter).

**The Node SDK is literally `MeetingRuntime`.** Same API surface, same Readable/Writable shape. MeetMind imports it via `kind: 'platform'`. External builders import it directly.

---

## §9 Risks (Rex-surfaced + architect prior)

| # | Risk | Mitigation |
|---|---|---|
| 1 | LiveKit Agents Framework couples MeetMind to LiveKit forever | Don't expose LiveKit SDK. Our WS gateway is the external contract. LiveKit swappable. |
| 2 | Recording = 3 products (raw per-participant, mixed, live transcript stream) | Define retention + PII + cost per product BEFORE building. Default: mixed only, 7-day retention, opt-in for raw. |
| 3 | Token/auth = the actual hard problem | Maya's scope grows ≫ Rex's. Tenant isolation, abuse/CSAM scan on recordings, publisher-vs-subscriber permissions. Treat as backend product, not runtime. |
| 4 | 800 ms budget tight: realistic p50 = 550–950 ms | Set internal SLO 60 ms on `WebRTC ingress → WS frame egress`. Alarm if exceeded. |
| 5 | Browser-participant SDK doubles Iris's scope | Web client = new product. Likely Iris-2 sub-agent. Budget time. |
| 6 | Sim runtime is a competitive moat | Ship publicly day one. Every AI builder evaluates with sim before paying. |
| 7 | Platform-side vs builder-side VAD | Default platform-side (consistency); per-token opt-out. |
| 8 | Storage cost: 115 MB/hr/participant raw 16k mono | Default: mixed-only recording at half-bitrate Opus, 7-day. Raw audio opt-in + billed-through. |
| 9 | Anti-bot detection problem disappears | Confirmed benefit. Cancel Patchright research. |

---

## §10 Phased plan

**Phase 1 — Gateway + WS contract + Sim SDK (4 weeks)**
- LiveKit Cloud dev project (Maya scope).
- WS gateway server (Python or Go, TBD): WebRTC ↔ WS PCM. Token verify. Resample/downmix. 60ms SLO.
- Public `callplatform` Python SDK + Node SDK. Wrap WS contract.
- Hoist `SimulatedMeetingRuntime` to public package as deterministic local fake.
- MeetMind: add `kind: 'platform'` to `MeetingRuntime`. Bump `meet-session.md` v0.3.0.
- Gate: dogfood MeetMind via platform end-to-end. p50 latency ≤800 ms.

**Phase 2 — Per-track audio + browser participant client (4 weeks)**
- `?stream=per-track` query param. Per-participant audio streams.
- Browser web client (Iris-2). LiveKit React under the hood, our own UI shell. Device picker, mute, screen, chat.
- Share-link UX. Anonymous join via signed link.

**Phase 3 — Recording + tenant auth (4 weeks)**
- LiveKit Egress integration. Recording row in DB. Webhook handler.
- Speaker-tagged transcript (per-participant STT, identity tagged).
- Tenant API key auth. Per-room JWT mint. Abuse/PII scan stub.

**Phase 4+ — Polish & expansion (ongoing)**
- SIP ingress (optional, for Vapi/Bland integration).
- Self-host SFU option (if Cloud cost > $300/mo).
- Public SDK + docs site.
- External-platform tiles (Meet/Zoom/Teams) stay locked `available: false` in MeetMind UI.

**Decision gate at end of Phase 1:** if `WebRTC→WS` hop can't hold 60ms SLO, 800 ms end-to-end budget dies. Re-plan before continuing.

---

## §11 Open questions (need founder decision)

1. **Repo structure:** new repo `callplatform/` next to MeetMind, OR new workspace `packages/callplatform/` + `services/call-gateway/` inside monorepo? Default: monorepo, separate when traction warrants.
2. **Naming:** `callplatform`, `convo`, `roomkit`, `open-room`, ?
3. **Open-source posture:** SDK + sim public day one (yes). Gateway server public (yes/no/later)?
4. **Tenant story:** single tenant (MeetMind only) for first 8 weeks, then multi-tenant? Or multi-tenant from day one?
5. **VAD default:** platform-side or builder-side?
6. **Recording retention default:** 7 days mixed, opt-in raw? Or longer / shorter?

---

## §12 What this replaces

- Prior plan: build "internal call infra" tightly coupled inside `services/`. Superseded.
- Real-Meet Playwright research: archive (already deprioritized 2026-05-20 decision-log). Confirm archive after Phase 1 gate.
- `mvp-scope.md` "Google Meet only" constraint: replace with "MeetMind Room via call-platform; external platforms gated."

---

## §13 Appendix — Rex consult (verbatim)

See decision-log 2026-05-21 entry. Key quote:

> "Build the standalone platform with **LiveKit as the internal SFU**, expose a single **WebSocket gateway speaking our existing `audio-pipe.md` 16k mono PCM contract** plus a JSON control sidechannel, ship a **deterministic local sim** as the public dev SDK, and keep `MeetingRuntime` as the canonical Node/Python consumer API — the platform becomes a third backing impl (`kind: 'platform'`) alongside `sim` and `real`."

Recommendation accepted as basis for Phase 1.
