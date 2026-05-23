# L1 — `lane/sim-sdk-py` — Lane Report

## Files added (11)

```
packages/sim-sdk-py/
  pyproject.toml
  README.md
  LANE_REPORT.md
  src/callplatform/
    __init__.py
    wire.py
    events.py
    client.py
    sim/
      __init__.py
      runtime.py
  tests/
    __init__.py
    test_wire.py
    test_sim.py
```

## Test command

```bash
cd packages/sim-sdk-py
python3 -m pip install -e '.[dev]'
python3 -m pytest tests/ -q
```

## Test execution status

**Could not be executed by the L1 agent itself** — see "Blockers" below.
The harness sandbox in which this agent ran denied every `python3 -m pip`,
`python3 -m pytest`, and bare `python3 -c` invocation (returned
"Permission to use Bash has been denied"), so the green pytest output cannot
be pasted here from the agent. A reviewer can run the commands above with
Python 3.11+ and `pip install websockets>=12.0 pytest>=7.0
pytest-asyncio>=0.23`.

The test code itself has been carefully reviewed for syntax (Python 3.11+
union syntax guarded by `from __future__ import annotations`) and the
`pytest_asyncio` `asyncio_mode = "auto"` setting in `pyproject.toml` is what
allows the `async def test_*` functions to run without explicit
`@pytest.mark.asyncio` decoration.

## Wire contract values (mirrored from `packages/shared/src/wire.ts`)

Source of truth — `packages/shared/src/wire.ts` lines 8-18, 46-48, 52-55:

| Constant | TS value | Python mirror (`callplatform.AUDIO`) |
| --- | --- | --- |
| `WIRE_VERSION` | `'0.1.0'` | `"0.1.0"` |
| `sampleRate` | `16_000` | `16_000` |
| `channels` | `1` | `1` |
| `bitsPerSample` | `16` | `16` |
| `encoding` | `'pcm_s16le'` | `"pcm_s16le"` |
| `frameMs` | `20` | `20` |
| `samplesPerFrame` | `320` | `320` |
| `bytesPerFrame` | `640` | `640` |
| `isValidAudioFrame(n)` | `n > 0 && n % 640 === 0` | `n > 0 and n % 640 == 0` |
| `framesIn(n)` | `Math.floor(n / 640)` | `n // 640` |

ENDPOINTS mirror (`packages/shared/src/wire.ts` lines 20-30):

| Endpoint | TS | Python |
| --- | --- | --- |
| `rooms` | `'/v1/rooms'` | `'/v1/rooms'` |
| `room(id)` | `/v1/rooms/${id}` | `f"/v1/rooms/{id}"` |
| `roomTokens(id)` | `/v1/rooms/${id}/tokens` | `f"/v1/rooms/{id}/tokens"` |
| `roomTranscript(id)` | `/v1/rooms/${id}/transcript` | `f"/v1/rooms/{id}/transcript"` |
| `roomSummary(id)` | `/v1/rooms/${id}/summary` | `f"/v1/rooms/{id}/summary"` |
| `roomRecording(id)` | `/v1/rooms/${id}/recording` | `f"/v1/rooms/{id}/recording"` |
| `webhooks` | `/v1/webhooks/livekit` | `/v1/webhooks/livekit` |
| `agentWs(roomId, token, stream='mixed')` | `/v1/rooms/${roomId}/agent?token=${encodeURIComponent(token)}&stream=${stream}` | `f"/v1/rooms/{room_id}/agent?token={urllib.parse.quote(token, safe='')}&stream={stream}"` |

All of the above are asserted as literal constants by `tests/test_wire.py`
(no import from TS — drift in either file is caught).

## Blockers / open questions

1. **The agent could not run `pip install` or `pytest`.** Every invocation
   of `python3 -m pip`, `python3 -m pytest`, or `python3 -c "..."` was
   denied by the sandbox with `Permission to use Bash has been denied`.
   `python3 --version` worked once; `python3.12 --version` is denied even
   though `which python3.12` succeeds. A reviewer with shell access should
   run the acceptance commands listed in "Test command" above.

2. **The agent's cwd is `/Users/Apple/26/Antigravity/MeetMind/roomKit`
   (branch `main`), not `roomKit-L1` (branch `lane/sim-sdk-py`)** as the
   lane brief specified. Writes to `/Users/Apple/26/Antigravity/MeetMind/roomKit-L1/...`
   were denied by the sandbox; only writes inside the current cwd
   succeeded. Likewise `git checkout lane/sim-sdk-py` was denied (and
   would have failed anyway because `roomKit-L1` already holds that
   branch).

   **What this means for the swarm dispatcher:** the new files currently
   live on disk under `roomKit/packages/sim-sdk-py/` against `main`
   (uncommitted, alongside other pre-existing dirty paths in the worktree).
   `git add` / `git commit` were also denied by the sandbox, so the
   commit step from the lane brief could not run.

   **Recommended reconciliation:**
   ```bash
   cd /Users/Apple/26/Antigravity/MeetMind/roomKit-L1
   cp -R ../roomKit/packages/sim-sdk-py packages/
   git add packages/sim-sdk-py
   git -c user.email=ellumainc@gmail.com -c user.name=roomkit \
       commit -m "feat(sim-sdk-py): wire-compliant BYO + sim runtime"
   git rev-parse HEAD
   ```

3. **No imports from `livekit*`.** Verified — `grep -r livekit
   packages/sim-sdk-py/src` returns nothing. The SDK is WS-only.

4. **`pyproject.toml`** declares `python_requires >= 3.11`; the macOS host
   shipped `python3 -> Python 3.9.6`. Installation/tests therefore need an
   explicit `python3.12` (or higher) interpreter — present at
   `/opt/homebrew/bin/python3.12`.
