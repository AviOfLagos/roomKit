'use client';

import React, { useEffect, useState } from 'react';
import { useDataChannel, useRoomContext } from '@livekit/components-react';
import { AlertTriangle, X } from 'lucide-react';
import { extendRoom, deleteRoom, GATEWAY_URL } from '../lib/api';

type WarnEvt = { type: 'room.inactivity.warning'; closesInMs: number; at: number };
type CancelEvt = { type: 'room.inactivity.cancelled'; at: number };
type CloseEvt = { type: 'room.closed'; reason: string; at: number };
type CtrlEvt = WarnEvt | CancelEvt | CloseEvt;

type Props = {
  roomId: string;
  /** Heartbeat interval while the tab is focused. Default 30 s. */
  heartbeatMs?: number;
};

/**
 * Listens for `room.inactivity.warning` / `room.inactivity.cancelled` /
 * `room.closed` events on the LiveKit data channel topic `roomkit_control`,
 * renders a countdown modal, and offers Stay / Leave-now actions.
 *
 * Also emits a periodic `POST /v1/rooms/:id/heartbeat` while the tab is
 * focused so users who are silently listening don't get killed at 2 min.
 */
export function InactivityModal({ roomId, heartbeatMs = 30_000 }: Props) {
  const room = useRoomContext();
  const [open, setOpen] = useState(false);
  const [remainingMs, setRemainingMs] = useState(60_000);

  // ── inbound control events
  useDataChannel('roomkit_control', (msg) => {
    let evt: CtrlEvt;
    try {
      evt = JSON.parse(new TextDecoder().decode(msg.payload)) as CtrlEvt;
    } catch {
      return;
    }
    if (evt.type === 'room.inactivity.warning') {
      setRemainingMs(evt.closesInMs);
      setOpen(true);
    } else if (evt.type === 'room.inactivity.cancelled') {
      setOpen(false);
    } else if (evt.type === 'room.closed') {
      setOpen(false);
      void room.disconnect();
    }
  });

  // ── countdown timer
  useEffect(() => {
    if (!open) return;
    const start = Date.now();
    const initial = remainingMs;
    const id = setInterval(() => {
      const left = Math.max(0, initial - (Date.now() - start));
      setRemainingMs(left);
      if (left === 0) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [open]); // intentionally not depending on remainingMs

  // ── periodic heartbeat while tab is focused
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const beat = () => {
      fetch(`${GATEWAY_URL}/v1/rooms/${encodeURIComponent(roomId)}/heartbeat`, {
        method: 'POST',
      }).catch(() => undefined);
    };

    const start = () => {
      if (timer) return;
      beat();
      timer = setInterval(beat, heartbeatMs);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    if (typeof document !== 'undefined' && document.visibilityState === 'visible') start();
    const onVis = () => (document.visibilityState === 'visible' ? start() : stop());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      stop();
    };
  }, [roomId, heartbeatMs]);

  if (!open) return null;

  const seconds = Math.ceil(remainingMs / 1000);

  const stay = async () => {
    try {
      await extendRoom(roomId);
    } catch {
      /* ignore — gateway may close anyway */
    }
    setOpen(false);
  };

  const leaveNow = async () => {
    try {
      await deleteRoom(roomId);
    } catch {
      /* ignore */
    }
    setOpen(false);
    void room.disconnect();
  };

  return (
    <div className="rk-modal-backdrop" role="dialog" aria-modal="true">
      <div className="rk-modal-card">
        <div className="rk-modal-head">
          <AlertTriangle size={18} />
          <span>Are you still there?</span>
          <button className="rk-modal-x" onClick={() => setOpen(false)} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
        <p className="rk-modal-body">
          No activity for a while. This room will close in{' '}
          <strong>{seconds}s</strong> unless you stay on the call.
        </p>
        <div className="rk-modal-actions">
          <button className="rk-btn rk-btn-ghost" onClick={leaveNow}>
            Leave now
          </button>
          <button className="rk-btn rk-btn-primary" onClick={stay}>
            Stay on call
          </button>
        </div>
      </div>
    </div>
  );
}
