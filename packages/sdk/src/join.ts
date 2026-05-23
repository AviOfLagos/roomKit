import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { AUDIO, ENDPOINTS } from '../../shared/dist/wire.js';
import type { RoomEvent } from '../../shared/dist/events.js';
import type { Call, JoinOptions } from './types.js';

/**
 * Connect to a roomKit gateway over WebSocket and return a `Call`
 * handle. Binary frames are audio (multiples of 640 bytes per the
 * frozen wire contract); text frames are `RoomEvent` JSON.
 *
 * No live gateway is required for tests — see `createSimulatedRoom`
 * for the in-process equivalent with identical surface.
 */
export async function join(options: JoinOptions): Promise<Call> {
  const { url, room, token, stream = 'mixed', participantId } = options;
  if (stream === 'per-track' && !participantId) {
    throw new Error("join: participantId is required when stream === 'per-track'");
  }
  const base = url.replace(/\/+$/, '');
  let target = `${base}${ENDPOINTS.agentWs(room, token, stream)}`;
  if (participantId) {
    target += `&participantId=${encodeURIComponent(participantId)}`;
  }

  const events = new EventEmitter();
  events.setMaxListeners(64);

  const ws = new WebSocket(target);

  const pendingRecv: Array<{
    resolve: (b: Buffer) => void;
    reject: (e: Error) => void;
  }> = [];
  const frameQueue: Buffer[] = [];
  let closed = false;
  let closeReason: Error | null = null;

  function deliverFrame(frame: Buffer): void {
    const waiter = pendingRecv.shift();
    if (waiter) waiter.resolve(frame);
    else frameQueue.push(frame);
  }

  function failPending(err: Error): void {
    for (const w of pendingRecv.splice(0)) w.reject(err);
  }

  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', (err: Error) => reject(err));
  });

  ws.on('message', (data: unknown, isBinary: boolean) => {
    if (isBinary) {
      // `data` is Buffer | ArrayBuffer | Buffer[] in ws@8.
      let buf: Buffer;
      if (Buffer.isBuffer(data)) {
        buf = data;
      } else if (Array.isArray(data)) {
        buf = Buffer.concat(data as Uint8Array[]);
      } else {
        buf = Buffer.from(data as ArrayBuffer);
      }
      if (buf.byteLength === 0 || buf.byteLength % AUDIO.bytesPerFrame !== 0) {
        events.emit('error', new Error(
          `join: bad audio frame size ${buf.byteLength} (not a multiple of ${AUDIO.bytesPerFrame})`,
        ));
        return;
      }
      deliverFrame(buf);
      return;
    }
    // Text frame — parse as RoomEvent JSON.
    try {
      const text = typeof data === 'string' ? data : Buffer.from(data as ArrayBuffer).toString('utf8');
      const evt = JSON.parse(text) as RoomEvent;
      events.emit(evt.type, evt);
      events.emit('event', evt);
    } catch (err) {
      events.emit('error', err);
    }
  });

  ws.on('close', () => {
    if (closed) return;
    closed = true;
    closeReason = closeReason ?? new Error('join: websocket closed');
    failPending(closeReason);
    events.emit('close');
  });

  ws.on('error', (err: Error) => {
    closeReason = err;
    events.emit('error', err);
  });

  const call: Call = {
    events,

    recv(): Promise<Buffer> {
      if (closed) return Promise.reject(closeReason ?? new Error('join: closed'));
      const queued = frameQueue.shift();
      if (queued) return Promise.resolve(queued);
      return new Promise<Buffer>((resolve, reject) => {
        pendingRecv.push({ resolve, reject });
      });
    },

    send(frame: Buffer): void {
      if (closed) throw new Error('join: closed');
      if (!Buffer.isBuffer(frame)) {
        throw new TypeError('join.send: frame must be a Buffer');
      }
      if (frame.byteLength === 0 || frame.byteLength % AUDIO.bytesPerFrame !== 0) {
        throw new RangeError(
          `join.send: frame size ${frame.byteLength} not a positive multiple of ${AUDIO.bytesPerFrame}`,
        );
      }
      ws.send(frame);
    },

    close(): void {
      if (closed) return;
      closed = true;
      try { ws.close(); } catch { /* ignore */ }
      failPending(closeReason ?? new Error('join: closed'));
      events.emit('close');
    },
  };

  return call;
}
