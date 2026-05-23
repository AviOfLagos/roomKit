'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDataChannel } from '@livekit/components-react';
import { Sparkles } from 'lucide-react';

/**
 * Subset of the shared `RoomEvent` union we render in the transcript pane.
 * Mirrors `packages/shared/src/events.ts` (only the bits we consume).
 */
type TranscriptEvent =
  | {
      type: 'transcript.partial';
      participantId: string;
      text: string;
      chunkId: string;
      at: number;
    }
  | {
      type: 'transcript.final';
      participantId: string;
      text: string;
      chunkId: string;
      confidence?: number;
      at: number;
    };

type Line = {
  chunkId: string;
  participantId: string;
  text: string;
  final: boolean;
  at: number;
};

export const ROOMKIT_CONTROL_TOPIC = 'roomkit_control';

export function TranscriptPanel() {
  const { message } = useDataChannel(ROOMKIT_CONTROL_TOPIC);
  const [lines, setLines] = useState<Line[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!message) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(message.payload));
    } catch {
      return;
    }
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('type' in parsed) ||
      typeof (parsed as { type: unknown }).type !== 'string'
    ) {
      return;
    }
    const t = (parsed as { type: string }).type;
    if (t !== 'transcript.partial' && t !== 'transcript.final') return;
    const ev = parsed as TranscriptEvent;
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.chunkId === ev.chunkId);
      const next: Line = {
        chunkId: ev.chunkId,
        participantId: ev.participantId,
        text: ev.text,
        final: ev.type === 'transcript.final',
        at: ev.at,
      };
      if (idx === -1) return [...prev, next];
      const copy = prev.slice();
      copy[idx] = next;
      return copy;
    });
  }, [message]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const ordered = useMemo(() => lines.slice().sort((a, b) => a.at - b.at), [lines]);

  return (
    <div className="rk-side-panel glass-panel p-4 flex flex-col h-full min-h-0">
      <div className="border-b border-zinc-900 pb-3 mb-3">
        <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" /> Live Transcript
        </h3>
        <span className="text-[10px] text-zinc-500">data channel: roomkit_control</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 pr-1">
        {ordered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-zinc-500 text-center px-4">
            Transcripts will appear here as people speak.
          </div>
        ) : (
          ordered.map((l) => (
            <div
              key={l.chunkId}
              className={`text-xs leading-relaxed p-2 rounded border ${
                l.final
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-200'
                  : 'bg-zinc-950 border-zinc-900 text-zinc-500 italic'
              }`}
            >
              <span className="block font-bold text-[10px] text-indigo-300 mb-0.5">
                {l.participantId}
              </span>
              {l.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
