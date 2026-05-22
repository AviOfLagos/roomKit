'use client';

import React, { useState } from 'react';
import { Sparkles, Video, Bot, Shield, ArrowRight, Copy, Check } from 'lucide-react';

export default function LandingPage() {
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful and friendly AI host.');
  const [defaultAgent, setDefaultAgent] = useState(true);
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [loading, setLoading] = useState(false);
  const [roomData, setRoomData] = useState<{ roomId: string; joinUrl: string; agentToken?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const createRoom = async () => {
    setLoading(true);
    try {
      // In Phase 1, we use 'dev' as the ROOMKIT_API_KEY
      const response = await fetch('/v1/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'dev',
        },
        body: JSON.stringify({
          context: { systemPrompt },
          defaultAgent,
          maxParticipants,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create room');
      }

      const data = await response.json();
      setRoomData(data);
    } catch (err) {
      console.error(err);
      alert('Error creating meeting room. Make sure the gateway server is running.');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (roomData) {
      navigator.clipboard.writeText(roomData.joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-950/20 via-zinc-950 to-black flex flex-col justify-between p-6 md:p-12">
      {/* Header */}
      <header className="flex justify-between items-center w-full max-w-7xl mx-auto mb-12">
        <div className="flex items-center gap-2">
          <Bot className="w-8 h-8 text-indigo-400 animate-glow" />
          <span className="font-display font-bold text-xl tracking-tight text-white">
            room<span className="text-indigo-400">Kit</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs bg-zinc-900/60 border border-zinc-800 rounded-full px-3 py-1.5 text-zinc-400 font-medium">
          <Shield className="w-3.5 h-3.5 text-indigo-400" />
          Phase 1 Active (API: dev)
        </div>
      </header>

      {/* Main Content Area */}
      <section className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full mb-12">
        {!roomData ? (
          <div className="w-full text-center md:text-left flex flex-col md:flex-row items-center gap-12">
            {/* Left Column: Hero info */}
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-3.5 py-1.5 rounded-full text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                Hosted WebRTC + Built-In AI Worker
              </div>
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-extrabold leading-none tracking-tight text-white">
                Meetings with <br />
                <span className="text-glow">Embedded AI</span>
              </h1>
              <p className="text-zinc-400 text-base md:text-lg max-w-md font-normal leading-relaxed">
                Mint instant conference rooms with a click. A context-aware Python AI participant joins automatically, transcribes speakers, and delivers summaries.
              </p>
            </div>

            {/* Right Column: Settings Card */}
            <div className="w-full max-w-md glass-panel p-8 space-y-6 text-left relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full filter blur-3xl pointer-events-none" />
              
              <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-indigo-400" /> Create a Room
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    AI Agent System Prompt
                  </label>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-sans"
                    rows={3}
                    placeholder="E.g. You are a friendly host..."
                    id="input-system-prompt"
                  />
                </div>

                <div className="flex items-center justify-between bg-zinc-950/40 border border-zinc-900 rounded-lg p-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white">Spawn Default AI Agent</span>
                    <span className="text-xs text-zinc-500">Agent joins automatically before humans</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={defaultAgent}
                    onChange={(e) => setDefaultAgent(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-zinc-950 border-zinc-800"
                    id="checkbox-default-agent"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Participant Limit
                  </span>
                  <span className="text-sm font-bold text-white bg-zinc-900 px-3 py-1 rounded border border-zinc-800">
                    {maxParticipants} Max
                  </span>
                </div>
              </div>

              <button
                onClick={createRoom}
                disabled={loading}
                className="w-full btn-glowing py-3.5 text-sm flex items-center justify-center gap-2"
                id="btn-create-room"
              >
                {loading ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Minting Room...
                  </span>
                ) : (
                  <>
                    Initialize Room <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Room Created View */
          <div className="w-full max-w-xl glass-panel p-8 text-center space-y-6 relative overflow-hidden animate-float">
            <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full filter blur-3xl pointer-events-none" />
            <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-2 animate-glow">
              <Sparkles className="w-6 h-6" />
            </div>

            <h1 className="font-display text-3xl font-extrabold text-white">Room Initialized!</h1>
            <p className="text-zinc-400 text-sm max-w-sm mx-auto">
              Your WebRTC meeting room is active and ready. Share the invite link below to join.
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-2 bg-zinc-950/80 border border-zinc-800 rounded-lg p-3">
                <span className="text-xs font-mono text-zinc-500 select-all truncate flex-1 text-left">
                  {roomData.joinUrl}
                </span>
                <button
                  onClick={copyLink}
                  className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white p-2 rounded transition-colors"
                  title="Copy Invite Link"
                  id="btn-copy-link"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {roomData.agentToken && (
                <div className="text-left bg-zinc-900/30 border border-zinc-900/60 rounded-lg p-4">
                  <span className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                    External AI Agent Token (BYO-AI)
                  </span>
                  <div className="font-mono text-[10px] text-indigo-300/80 break-all select-all leading-tight bg-zinc-950 p-2.5 rounded border border-zinc-900 max-h-16 overflow-y-auto">
                    {roomData.agentToken}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => setRoomData(null)}
                className="flex-1 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white font-medium py-3 rounded-lg border border-zinc-800 transition-colors text-sm"
                id="btn-new-room"
              >
                Back to Settings
              </button>
              <a
                href={`/room/${roomData.roomId}`}
                className="flex-1 btn-glowing py-3 flex items-center justify-center gap-1.5 text-sm decoration-none"
                id="link-join-room"
              >
                Enter Call <Video className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="text-center w-full max-w-7xl mx-auto border-t border-zinc-900 pt-6 text-zinc-600 text-xs">
        &copy; {new Date().getFullYear()} roomKit Inc. Apache 2.0 License. Designed for premium real-time AI agents.
      </footer>
    </main>
  );
}
