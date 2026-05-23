# Lane L3 — Web Client

Branch: `lane/web-client` (worktree `roomKit-L3`).
Scope is strictly inside `apps/web/src/**`, `apps/web/public/**` and
`apps/web/next.config.mjs`. No `package.json` / `tsconfig.json` changes;
no new npm deps.

## File tree

```
apps/web/
├── LANE_REPORT.md                              (new — this file)
├── next.config.mjs                             (new — replaces next.config.js)
└── src/
    ├── app/
    │   ├── index.css                           (modified — layout primitives)
    │   ├── layout.tsx                          (unchanged)
    │   ├── page.tsx                            (rewritten — single CTA)
    │   └── room/
    │       └── %5BroomId%5D/                   (Next dynamic [roomId])
    │           ├── page.tsx                    (rewritten — name + LiveKit)
    │           └── ended/
    │               └── page.tsx                (new — polls /summary)
    ├── components/                             (new directory)
    │   ├── CallControlBar.tsx
    │   ├── ChatPanel.tsx
    │   ├── NamePrompt.tsx
    │   ├── RoomShell.tsx
    │   ├── SidePanel.tsx
    │   ├── TranscriptPanel.tsx
    │   └── VideoGrid.tsx
    └── lib/
        └── api.ts                              (new — fetch helpers + env)
```

Deleted: `apps/web/next.config.js` (superseded by `.mjs`).

## Components map

| File | Role |
| --- | --- |
| `lib/api.ts` | `createRoom`, `mintHumanToken`, `fetchSummary`, reads `NEXT_PUBLIC_ROOMKIT_API_KEY` (default `dev`) and `NEXT_PUBLIC_LIVEKIT_URL` (default `ws://localhost:7880`). |
| `app/page.tsx` | Landing page — single `Create a Room` CTA, displays `roomId` + copyable invite link, then `Enter call` button to `joinUrl`. |
| `app/room/[roomId]/page.tsx` | Prompts for display name (persisted in `localStorage`), mints human token, hands off to `RoomShell`. |
| `app/room/[roomId]/ended/page.tsx` | Polls `GET /v1/rooms/:id/summary` every 5 s until a 200 body is returned. |
| `components/NamePrompt.tsx` | Pre-join form with persisted display name. |
| `components/RoomShell.tsx` | `<LiveKitRoom>` wrapper + room layout (header, video grid, side panel, audio renderer). |
| `components/VideoGrid.tsx` | LiveKit `GridLayout` + `ParticipantTile` over camera + screen-share tracks. |
| `components/CallControlBar.tsx` | Mic / cam / screen-share toggles + leave button (uses `useLocalParticipant` + `useRoomContext`). |
| `components/SidePanel.tsx` | Tabbed wrapper switching between transcript and chat. |
| `components/TranscriptPanel.tsx` | Subscribes to LiveKit data channel topic `roomkit_control`, renders `transcript.partial` / `transcript.final` events from the shared `RoomEvent` union. |
| `components/ChatPanel.tsx` | Sends and renders `{type:'chat.message', participantId, text, at}` events on the same `roomkit_control` topic. |
| `next.config.mjs` | Rewrites `/v1/:path*` → `${NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:3000'}/v1/:path*`. |
| `app/index.css` | Adds `.rk-*` layout classes + a minimal fallback for `lk-participant-tile` (so the LiveKit tile renders without the optional `@livekit/components-styles` package — which is not in `package.json`). |

## Manual test plan

Prereqs (handled by orchestrator): `pnpm install` at repo root, the
gateway (lane L0/L4) running on `:3000`, LiveKit running on `:7880`.

From the L3 worktree:

```bash
cd apps/web
pnpm dev      # next dev -p 3001
```

1. **Create a room.** Open <http://localhost:3001>, click `Create a Room`.
   Equivalent curl:
   ```bash
   curl -X POST http://localhost:3001/v1/rooms \
     -H 'x-api-key: dev' \
     -H 'content-type: application/json' \
     -d '{"defaultAgent":true}'
   ```
   Expect a JSON body with `roomId`, `joinUrl`, `agentToken`.
2. **Join as a human.** Click `Enter call` (or open the `joinUrl`). The
   name prompt should appear, default to whatever is in
   `localStorage['roomkit:displayName']`, and on submit POST:
   ```bash
   curl -X POST http://localhost:3001/v1/rooms/<roomId>/tokens \
     -H 'x-api-key: dev' \
     -H 'content-type: application/json' \
     -d '{"role":"human","identity":"human-abc","displayName":"Alex"}'
   ```
   Once the token comes back, the page connects to `NEXT_PUBLIC_LIVEKIT_URL`
   (default `ws://localhost:7880`) and shows a tile for you plus any other
   participants (default agent included).
3. **Exercise controls.** Toggle mic (`#btn-toggle-mic`), camera
   (`#btn-toggle-cam`), screen-share (`#btn-toggle-screen`). Switch the
   side panel between `Transcript` and `Chat`. Sending a chat message
   should publish a binary payload on the LiveKit data channel topic
   `roomkit_control` with body `{"type":"chat.message","participantId":...,"text":"...","at":...}`,
   and remote `transcript.partial` / `transcript.final` events on the
   same topic should stream into the transcript pane.
4. **End the call.** Click the red phone button (or call
   `room.disconnect()`). The browser navigates to
   `/room/<roomId>/ended`, which polls every 5 s:
   ```bash
   watch -n 5 'curl -s -H "x-api-key: dev" http://localhost:3001/v1/rooms/<roomId>/summary'
   ```
   When the gateway returns a 200 with `{"summary":"…"}` the page
   stops polling and renders the markdown summary.

## Known gaps (TODOs for future lanes)

- **No `@livekit/components-styles` import.** That package isn't in
  `apps/web/package.json` and L3 may not add deps; the fallback CSS in
  `index.css` gives tiles a sane look, but a future lane should add the
  official stylesheet for richer prebuilt UI (focus speaker, connection
  quality indicator, etc.).
- **No Tailwind runtime.** Inline `className` strings follow Tailwind
  naming conventions for readability, but only the custom utility
  classes (`glass-panel`, `btn-glowing`, `text-glow`, `rk-*`, etc.)
  defined in `index.css` actually apply. If a future lane enables
  Tailwind the markup is already authored against its tokens.
- **Identity is random.** Each visit generates `human-xxxxxx`; tenant /
  auth lane (L6) should plug in real identities.
- **Summary endpoint contract.** `lib/api.ts#fetchSummary` treats both
  `404` and `202` as "not ready yet" — confirm with the gateway lane
  (L0) which status code it actually returns while the summary is
  pending.
- **Chat history is local.** Messages are stored in component state only;
  late joiners do not see scrollback. A future lane could persist via
  `GET /v1/rooms/:id/transcript` or a dedicated chat endpoint.
- **`useDataChannel` topic name.** Spec uses `roomkit_control` for both
  transcripts and chat. If lanes split these onto different topics, swap
  the constant `ROOMKIT_CONTROL_TOPIC` in `TranscriptPanel.tsx`.
