# SWARM — roomKit parallel build coordination

**Owner of this file:** orchestrator (main thread). Lane agents ⊥ write here.

**Date opened:** 2026-05-22 · **Contract:** `packages/shared/src/wire.ts` (FROZEN @ v0.1.0) + `packages/shared/src/events.ts` · **Tests:** `pnpm --filter @roomkit/shared test`

## Rules

- ∀ lane works in own `git worktree` at `../roomKit-L<n>` on branch `lane/<name>`.
- ∀ lane must rebase nightly via orchestrator (lane agents ⊥ rebase).
- ⊥ lane may modify `packages/shared/src/{wire,events}.ts` — contract is FROZEN.
- ⊥ lane may modify root `package.json`, `pnpm-workspace.yaml`, `infra/docker-compose.yml`.
- ! every lane must write `LANE_REPORT.md` at worktree root on exit:
  - files touched
  - invariants held (cite §)
  - blockers / open questions
- Merge gate: `pnpm --filter @roomkit/shared test` green + cavecrew-reviewer pass.

## Status legend

`.` todo · `~` wip · `x` done · `!` blocked · `?` waiting on dep

## Lane board

| id  | status | wave | branch              | worktree           | scope (files)                                                                       | depends on | owner |
|-----|--------|------|---------------------|--------------------|-------------------------------------------------------------------------------------|------------|-------|
| L1  | .      | A    | lane/sim-sdk-py     | ../roomKit-L1      | `packages/sim-sdk-py/**` (new)                                                      | —          | —     |
| L2  | .      | A    | lane/sim-sdk-node   | ../roomKit-L2      | `packages/sdk/**` (new — Node `join()` API)                                         | —          | —     |
| L3  | .      | A    | lane/web-client     | ../roomKit-L3      | `apps/web/src/**`                                                                   | —          | —     |
| L5  | .      | A    | lane/recording      | ../roomKit-L5      | `services/gateway/src/routes/recording.ts` (new) + `services/gateway/src/livekit.ts` egress helper | — | — |
| L6  | .      | A    | lane/tenant-auth    | ../roomKit-L6      | `services/gateway/src/routes/tokens.ts` (new) + `infra/postgres/init.sql`           | —          | —     |
| L8  | .      | A    | lane/examples-docs  | ../roomKit-L8      | `examples/**` + `docs/**`                                                           | —          | —     |
| L4  | .      | B    | lane/per-track-ws   | ../roomKit-L4      | `services/gateway/src/gateway/ws-bridge.ts` + `services/gateway/src/gateway/livekit_bridge.py` | L1, L2 (for sim test harness) | — |
| L7  | .      | B    | lane/supervisor     | ../roomKit-L7      | `services/gateway/src/gateway/supervisor.ts` (new) + 1-line hook in `ws-bridge.ts`  | L4         | —     |

## Conflict map

- L4 & L7 both touch `ws-bridge.ts` → L4 owns body, L7 owns new `supervisor.ts` + 1 import line.
- L5 may need new `recordings`-related table → schema-owner = L6; coordinate via comment in L5 LANE_REPORT.md asking L6 to add.

## Decision gates

- **G_phase1:** end-of-wave-B → dogfood default agent through new sim sdk path. p50 latency ≤ 800 ms end-to-end. If miss → re-plan per `docs/call-platform-feasibility.md` §10.
