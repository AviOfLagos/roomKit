'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, FileText, Loader2, ArrowLeft } from 'lucide-react';
import { fetchSummary, type SummaryResponse } from '../../../../lib/api';

/**
 * Post-call summary page. Polls `GET /v1/rooms/:id/summary` every 5s
 * until the gateway returns a 200 with a body.
 */
export default function RoomEndedPage() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const roomId = decodeURIComponent(params?.roomId ?? '');
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetchSummary(roomId);
        if (cancelled) return;
        if (res) {
          setSummary(res);
          return;
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load summary');
      }
      timer = setTimeout(poll, 5000);
    };

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [roomId]);

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6">
      <div className="glass-panel w-full max-w-2xl p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl text-white">Call ended</h1>
            <span className="text-[11px] font-mono text-zinc-500 select-all">{roomId}</span>
          </div>
        </div>

        <div className="border border-zinc-900 rounded-lg p-5 bg-zinc-950/60 min-h-[160px]">
          <h2 className="font-display font-bold text-sm text-white flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-indigo-400" /> Summary
          </h2>

          {summary ? (
            <article className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
              {summary.summary}
            </article>
          ) : error ? (
            <div className="text-sm text-red-400 space-y-1">
              <p>{error}</p>
              <p className="text-xs text-red-400/70">Retrying every 5 seconds…</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              Waiting for AI summary… (polls every 5 s)
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => router.push('/')}
            className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-medium py-3 rounded-lg border border-zinc-800 transition-colors text-sm flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </button>
          <button
            onClick={() => router.push(`/room/${encodeURIComponent(roomId)}`)}
            className="flex-1 btn-glowing py-3 text-sm"
          >
            Re-join room
          </button>
        </div>
      </div>
    </main>
  );
}
