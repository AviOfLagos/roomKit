import { EventEmitter } from 'node:events';
import { AUDIO } from '../../shared/dist/wire.js';
import type { Call, SimulatedRoomOptions, SimulatedRoomScriptStep } from './types.js';

/**
 * Deterministic in-process Call simulator. Replays a script of
 * `RoomEvent`s + audio frames in order, with cooperative back-pressure
 * so EventEmitter `.once()` consumers don't miss events between awaits.
 *
 * Scheduling model: each script step runs on its own `setImmediate` tick.
 * That guarantees an awaiting consumer's continuation runs (and can
 * re-subscribe) before the next step fires — making the EE `.once()`
 * loop pattern in the §8 SDK example reliable.
 *
 * Frames are queued. `recv()` resolves with the next queued frame, or
 * waits for the next one if the queue is empty. Events are emitted on
 * both their `type` channel and a generic `'event'` channel.
 *
 * No network, no `ws` dep — usable in `node --test` and any CI sandbox.
 */
export function createSimulatedRoom(options: SimulatedRoomOptions): Call {
  const script: SimulatedRoomScriptStep[] = [...options.script];
  const events = new EventEmitter();
  events.setMaxListeners(64);

  let closed = false;
  const pendingRecv: Array<{
    resolve: (b: Buffer) => void;
    reject: (e: Error) => void;
  }> = [];
  const frameQueue: Buffer[] = [];
  let cursor = 0;

  function deliverFrame(frame: Buffer): void {
    const waiter = pendingRecv.shift();
    if (waiter) waiter.resolve(frame);
    else frameQueue.push(frame);
  }

  // Validate frames eagerly so a malformed script throws to the caller
  // instead of silently emitting bad data later.
  for (const step of script) {
    if (step.frame !== undefined) {
      if (!Buffer.isBuffer(step.frame)) {
        throw new TypeError('SimulatedRoom: frame must be a Buffer');
      }
      if (
        step.frame.byteLength === 0 ||
        step.frame.byteLength % AUDIO.bytesPerFrame !== 0
      ) {
        throw new RangeError(
          `SimulatedRoom: frame size ${step.frame.byteLength} not a positive multiple of ${AUDIO.bytesPerFrame}`,
        );
      }
    }
  }

  function tick(): void {
    if (closed || cursor >= script.length) return;
    const step = script[cursor++];
    if (step.event) {
      const ev = step.event;
      events.emit(ev.type, ev);
      events.emit('event', ev);
    }
    if (step.frame) {
      deliverFrame(step.frame);
    }
    // Hand control back to awaiting consumers before the next step.
    setImmediate(tick);
  }

  // Kick off after the synchronous return — gives callers time to
  // subscribe to events before the first emission.
  setImmediate(tick);

  const call: Call = {
    events,

    recv(): Promise<Buffer> {
      if (closed) return Promise.reject(new Error('SimulatedRoom: closed'));
      const queued = frameQueue.shift();
      if (queued) return Promise.resolve(queued);
      return new Promise<Buffer>((resolve, reject) => {
        pendingRecv.push({ resolve, reject });
      });
    },

    send(frame: Buffer): void {
      if (closed) throw new Error('SimulatedRoom: closed');
      if (!Buffer.isBuffer(frame)) {
        throw new TypeError('SimulatedRoom.send: frame must be a Buffer');
      }
      if (frame.byteLength === 0 || frame.byteLength % AUDIO.bytesPerFrame !== 0) {
        throw new RangeError(
          `SimulatedRoom.send: frame size ${frame.byteLength} not a positive multiple of ${AUDIO.bytesPerFrame}`,
        );
      }
      // Outbound frames are accepted and re-emitted on `'sent'` so
      // tests can observe them without a real socket peer.
      events.emit('sent', frame);
    },

    close(): void {
      if (closed) return;
      closed = true;
      for (const w of pendingRecv.splice(0)) {
        w.reject(new Error('SimulatedRoom: closed'));
      }
      events.emit('close');
    },
  };

  return call;
}
