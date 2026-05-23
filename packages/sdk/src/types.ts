import { EventEmitter } from 'node:events';
import type { RoomEvent } from '../../shared/dist/events.js';
import type { StreamMode } from '../../shared/dist/wire.js';

/**
 * Public Call handle returned by `join()` and `createSimulatedRoom()`.
 *
 * Same primitives the docs describe: `recv() -> Buffer`, `send(Buffer)`,
 * `events` EventEmitter, `close()`. Identical shape for the real
 * transport and the deterministic in-process simulator.
 */
export interface Call {
  /**
   * Resolves with the next inbound audio frame (`Buffer`, multiple of
   * 640 bytes per the wire contract). Rejects with the close reason if
   * the call ends before another frame arrives.
   */
  recv(): Promise<Buffer>;

  /**
   * Send an outbound audio frame. Must be a multiple of 640 bytes
   * (16 kHz mono Int16 LE, 20 ms frames).
   */
  send(frame: Buffer): void;

  /**
   * Emits `RoomEvent` JSON messages from the gateway. Each event is
   * emitted on its `type` (`'room.joined'`, `'speech.ended'`, ...) and
   * also on the generic channel `'event'` for catch-all listeners.
   */
  events: EventEmitter;

  /** Close the underlying transport. Idempotent. */
  close(): void;
}

export interface JoinOptions {
  /** Gateway base URL, e.g. `ws://localhost:3000`. */
  url: string;
  /** Room id. */
  room: string;
  /** Signed JWT room token. */
  token: string;
  /** `'mixed'` (default) or `'per-track'`. */
  stream?: StreamMode;
  /** Required when `stream === 'per-track'` — id of the participant to subscribe to. */
  participantId?: string;
}

export interface SimulatedRoomScriptStep {
  /** Emit a RoomEvent on the events channel. */
  event?: RoomEvent;
  /**
   * Enqueue an inbound audio frame to be returned by the next
   * `recv()` call. Must be a multiple of 640 bytes.
   */
  frame?: Buffer;
}

export interface SimulatedRoomOptions {
  /**
   * Ordered list of steps replayed deterministically. Events and frames
   * are surfaced in the order given; consumers awaiting `recv()` or an
   * event will only see steps in script order.
   */
  script: SimulatedRoomScriptStep[];
}

export type { RoomEvent } from '../../shared/dist/events.js';
export { AUDIO, ENDPOINTS, WIRE_VERSION, isValidAudioFrame } from '../../shared/dist/wire.js';
