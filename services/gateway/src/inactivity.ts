import { sql } from './db.js';
import { forceEndRoom, getRoomServiceClient } from './livekit.js';

/**
 * In-memory inactivity tracker.
 *
 * Per room: lastActivityMs + whether a warning has been broadcast yet.
 * A single interval scans the map every TICK_MS. Transitions:
 *
 *   t - lastActivity ≥ IDLE_WARN_MS   → broadcast 'room.inactivity.warning'
 *   t - lastActivity ≥ IDLE_CLOSE_MS  → forceEndRoom + DB ended + broadcast 'room.closed'
 *
 * Activity sources that bump the timestamp:
 *   - room create (rooms.ts)
 *   - participant_joined webhook (webhooks.ts)
 *   - POST /v1/rooms/:id/heartbeat (web, agent)
 *   - POST /v1/rooms/:id/extend     (user clicked "Stay" in modal)
 *
 * Broadcast travels on the LiveKit data channel topic `roomkit_control`,
 * which both the web client and BYO agents subscribe to.
 */

const TICK_MS = parseInt(process.env.INACTIVITY_TICK_MS || '10000', 10);
export const IDLE_WARN_MS = parseInt(process.env.IDLE_WARN_MS || '120000', 10); // 2 min
export const IDLE_CLOSE_MS = parseInt(process.env.IDLE_CLOSE_MS || '180000', 10); // 3 min
const CONTROL_TOPIC = 'roomkit_control';

interface RoomState {
  lastActivityMs: number;
  warned: boolean;
}

const rooms = new Map<string, RoomState>();
let intervalHandle: NodeJS.Timeout | null = null;

export function trackRoom(roomId: string): void {
  rooms.set(roomId, { lastActivityMs: Date.now(), warned: false });
}

export function bump(roomId: string): void {
  const existing = rooms.get(roomId);
  if (!existing) {
    rooms.set(roomId, { lastActivityMs: Date.now(), warned: false });
    return;
  }
  existing.lastActivityMs = Date.now();
  existing.warned = false;
}

export function untrack(roomId: string): void {
  rooms.delete(roomId);
}

export function getState(roomId: string): RoomState | undefined {
  return rooms.get(roomId);
}

async function broadcast(roomId: string, payload: object): Promise<void> {
  try {
    const client = getRoomServiceClient();
    const data = Buffer.from(JSON.stringify(payload), 'utf8');
    // sendData signature in livekit-server-sdk v2:
    //   sendData(roomName, data, kind, options?) — kind=0 is RELIABLE
    await client.sendData(roomId, data, 0, { topic: CONTROL_TOPIC });
  } catch (err: any) {
    console.error(`[inactivity] broadcast failed for ${roomId}: ${err.message}`);
  }
}

async function closeRoom(roomId: string): Promise<void> {
  await broadcast(roomId, {
    type: 'room.closed',
    reason: 'inactivity',
    at: Date.now(),
  });
  try {
    await sql`UPDATE rooms SET status = 'ended', ended_at = NOW() WHERE id = ${roomId} AND status = 'active'`;
  } catch (err: any) {
    console.error(`[inactivity] db update failed for ${roomId}: ${err.message}`);
  }
  await forceEndRoom(roomId);
  untrack(roomId);
}

async function tick(): Promise<void> {
  const now = Date.now();
  for (const [roomId, state] of rooms) {
    const idleMs = now - state.lastActivityMs;
    if (idleMs >= IDLE_CLOSE_MS) {
      console.log(`[inactivity] closing room ${roomId} after ${idleMs}ms idle`);
      await closeRoom(roomId);
      continue;
    }
    if (idleMs >= IDLE_WARN_MS && !state.warned) {
      state.warned = true;
      const closesInMs = Math.max(0, IDLE_CLOSE_MS - idleMs);
      console.log(`[inactivity] warning room ${roomId}, closes in ${closesInMs}ms`);
      await broadcast(roomId, {
        type: 'room.inactivity.warning',
        closesInMs,
        at: now,
      });
    }
  }
}

export function startInactivityMonitor(): void {
  if (intervalHandle) return;
  console.log(
    `[inactivity] monitor starting (warn=${IDLE_WARN_MS}ms, close=${IDLE_CLOSE_MS}ms, tick=${TICK_MS}ms)`
  );
  intervalHandle = setInterval(() => {
    tick().catch((err) => console.error(`[inactivity] tick error: ${err.message}`));
  }, TICK_MS);
  // Don't block process exit on the interval.
  intervalHandle.unref?.();
}

export function stopInactivityMonitor(): void {
  if (!intervalHandle) return;
  clearInterval(intervalHandle);
  intervalHandle = null;
}

/**
 * Public helper for the /extend endpoint: bumps activity AND broadcasts a
 * cancellation event so clients showing the modal know to dismiss it
 * before their countdown finishes.
 */
export async function extendRoom(roomId: string): Promise<void> {
  bump(roomId);
  await broadcast(roomId, {
    type: 'room.inactivity.cancelled',
    at: Date.now(),
  });
}
