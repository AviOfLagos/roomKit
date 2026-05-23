'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { NamePrompt } from '../../../components/NamePrompt';
import { RoomShell } from '../../../components/RoomShell';
import { mintHumanToken } from '../../../lib/api';

const DISPLAY_NAME_KEY = 'roomkit:displayName';

type JoinStatus =
  | { kind: 'naming' }
  | { kind: 'connecting' }
  | { kind: 'ready'; token: string; displayName: string }
  | { kind: 'error'; message: string };

/**
 * Room page — prompts the visitor for a display name (persisted in
 * localStorage), mints a `human`-role token from the gateway, and hands
 * it to the LiveKit `<LiveKitRoom>` wrapper inside `RoomShell`.
 */
export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const roomId = decodeURIComponent(params?.roomId ?? '');

  const [storedName, setStoredName] = useState<string>('');
  const [status, setStatus] = useState<JoinStatus>({ kind: 'naming' });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(DISPLAY_NAME_KEY) ?? '';
    setStoredName(saved);
  }, []);

  const join = async (name: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISPLAY_NAME_KEY, name);
    }
    setStatus({ kind: 'connecting' });
    const identity = `human-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const { token } = await mintHumanToken(roomId, identity, name);
      setStatus({ kind: 'ready', token, displayName: name });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not join room',
      });
    }
  };

  if (status.kind === 'naming') {
    return <NamePrompt defaultName={storedName} onSubmit={join} />;
  }

  if (status.kind === 'connecting') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <span className="text-zinc-400 text-sm font-display">Joining room…</span>
      </div>
    );
  }

  if (status.kind === 'error') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 p-6">
        <div className="glass-panel p-6 max-w-md text-center space-y-3">
          <h2 className="font-display font-bold text-lg text-white">Could not join</h2>
          <p className="text-sm text-zinc-400 break-words">{status.message}</p>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setStatus({ kind: 'naming' })}
              className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-medium py-2.5 rounded-lg border border-zinc-800 transition-colors text-sm"
            >
              Try again
            </button>
            <button
              onClick={() => router.push('/')}
              className="flex-1 btn-glowing py-2.5 text-sm"
            >
              Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <RoomShell roomId={roomId} token={status.token} displayName={status.displayName} />;
}
