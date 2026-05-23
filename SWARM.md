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
| L1  | x      | A    | lane/sim-sdk-py     | (sandbox blocked sibling worktrees → built in main cwd, committed via branch-switch) | `packages/sim-sdk-py/**` | — | subagent + orch |
| L2  | x      | A    | lane/sim-sdk-node   | (same)             | `packages/sdk/**`                                                                   | —          | subagent + orch |
| L3  | x      | A    | lane/web-client     | (same)             | `apps/web/**`                                                                       | —          | subagent + orch |
| L5  | x      | A    | lane/recording      | (main-thread direct after 3 subagent attempts failed) | `services/gateway/src/routes/recording.ts` + `services/gateway/src/livekit.ts` | — | orch |
| L6  | x      | A    | lane/tenant-auth    | (main-thread direct after 3 subagent attempts failed) | `services/gateway/src/routes/tokens.ts` + `infra/postgres/init.sql` | — | orch |
| L8  | x      | A    | lane/examples-docs  | (main-thread direct)                                  | `examples/**` + `docs/**` | — | orch |
| L4  | .      | B    | lane/per-track-ws   | (main-thread plan)                                    | `services/gateway/src/gateway/ws-bridge.ts` + `services/gateway/src/gateway/livekit_bridge.py` | L1, L2 | — |
| L7  | .      | B    | lane/supervisor     | (main-thread plan)                                    | `services/gateway/src/gateway/supervisor.ts` (new) + 1-line hook in `ws-bridge.ts` | L4 | — |

## Conflict map

- L4 & L7 both touch `ws-bridge.ts` → L4 owns body, L7 owns new `supervisor.ts` + 1 import line.
- L5 may need new `recordings`-related table → schema-owner = L6; coordinate via comment in L5 LANE_REPORT.md asking L6 to add.

## Lessons learned (wave-A)

- **Sandbox boundary**: subagents cannot access sibling worktrees (`../roomKit-L*`) — only `/Users/Apple/26/Antigravity/MeetMind/roomKit/**`. Pre-creating worktrees outside cwd = wasted work.
- **Subagent git is blocked**: subagents can write files into cwd but cannot run `git add`/`commit`. Orchestrator (main thread) must do the commit + branch-switch step.
- **`cavecrew-builder` lacks Bash + refuses LANE_REPORT.md as a 3rd file**: use `general-purpose` for any lane that needs to write a status report or run shell.
- **Race risk**: parallel subagents all wrote into the same cwd. File scopes were disjoint so no collisions, but staging by pathspec was critical at commit time.
- **Working pattern for wave-B+**: spawn agent with explicit cwd files, instruct it to NOT run git, then orchestrator stashes + branch-switches + commits.

## Decision gates

- **G_phase1:** end-of-wave-B → dogfood default agent through new sim sdk path. p50 latency ≤ 800 ms end-to-end. If miss → re-plan per `docs/call-platform-feasibility.md` §10.
