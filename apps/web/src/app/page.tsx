'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Video, Bot, Shield, ArrowRight, Copy, Check } from 'lucide-react';
import { createRoom, type CreateRoomResponse } from '../lib/api';

/**
 * Landing page — single CTA `Create a Room`.
 *
 * Hits the gateway via the Next.js `/v1/*` rewrite, then either redirects
 * straight to the returned `joinUrl` path or surfaces the result so the
 * host can copy the share link and tokens before entering.
 */
export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<CreateRoomResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await createRoom({ defaultAgent: true });
      setRoom(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const joinPath = (() => {
    if (!room) return null;
    try {
      const url = new URL(room.joinUrl);
      return url.pathname + url.search;
    } catch {
      // joinUrl may already be a relative path
      return room.joinUrl.startsWith('/') ? room.joinUrl : `/room/${room.roomId}`;
    }
  })();

  const copyLink = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <main className="rk-landing min-h-screen flex flex-col p-6 md:p-12">
      <header className="flex justify-between items-center w-full max-w-6xl mx-auto mb-12">
        <div className="flex items-center gap-2">
          <Bot className="w-7 h-7 text-indigo-400 animate-glow" />
          <span className="font-display font-bold text-lg tracking-tight text-white">
            room<span className="text-indigo-400">Kit</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs bg-zinc-900/60 border border-zinc-800 rounded-full px-3 py-1.5 text-zinc-400 font-medium">
          <Shield className="w-3.5 h-3.5 text-indigo-400" />
          Phase 1 (api-key: dev)
        </div>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto w-full text-center space-y-8">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-3.5 py-1.5 rounded-full text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          Hosted WebRTC + Built-In AI
        </div>

        <h1 className="font-display text-4xl md:text-6xl font-extrabold leading-tight tracking-tight text-white">
          One click meetings with <span className="text-glow">embedded AI</span>
        </h1>

        <p className="text-zinc-400 text-base md:text-lg max-w-xl">
          Mint a roomKit room, share the link, and let the platform handle
          WebRTC, transcription, and an AI host out of the box.
        </p>

        {!room ? (
          <>
            <button
              id="btn-create-room"
              onClick={handleCreate}
              disabled={loading}
              className="btn-glowing px-8 py-4 text-base flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  Create a Room <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
            {error && (
              <p className="text-sm text-red-400 max-w-md">
                {error}
                <br />
                <span className="text-xs text-red-400/70">
                  Is the gateway running on NEXT_PUBLIC_GATEWAY_URL?
                </span>
              </p>
            )}
          </>
        ) : (
          <div className="w-full max-w-xl glass-panel p-6 space-y-5 text-left">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display font-bold text-base text-white">Room created</h2>
                <span className="text-[11px] font-mono text-zinc-500 select-all">
                  {room.roomId}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5">
              <span
                id="text-join-url"
                className="text-[11px] font-mono text-zinc-300 select-all truncate flex-1"
              >
                {room.joinUrl}
              </span>
              <button
                id="btn-copy-link"
                onClick={copyLink}
                title="Copy invite link"
                className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white p-2 rounded transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setRoom(null)}
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-medium py-3 rounded-lg border border-zinc-800 transition-colors text-sm"
              >
                New room
              </button>
              <button
                id="btn-enter-room"
                onClick={() => joinPath && router.push(joinPath)}
                className="flex-1 btn-glowing py-3 flex items-center justify-center gap-1.5 text-sm"
              >
                Enter call <Video className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      <footer className="text-center w-full max-w-6xl mx-auto border-t border-zinc-900 pt-6 mt-12 text-zinc-600 text-xs">
        &copy; {new Date().getFullYear()} roomKit — Apache 2.0
      </footer>
    </main>
  );
}
