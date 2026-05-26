'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Bot,
  Check,
  Code,
  Copy,
  Github,
  Layers,
  PlayCircle,
  Radio,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react';
import { createRoom, type CreateRoomResponse } from '../lib/api';

type Lang = 'python' | 'node';

const SNIPPETS: Record<Lang, string> = {
  python: `from callplatform import join

async with join(room_id="room-abc", token=TOKEN) as call:
    async for ev in call.events():
        if ev["type"] == "speech.ended":
            audio = await call.recv()        # 16k mono PCM, 640 B / 20 ms
            await call.send(my_llm_and_tts(audio))`,
  node: `import { join } from '@roomkit/sdk';

const call = await join({ url: WS_URL, room: 'room-abc', token: TOKEN });
call.events.on('event', async (ev) => {
  if (ev.type === 'speech.ended') {
    const audio = await call.recv();        // Buffer, multiples of 640 B
    call.send(await myLlmAndTts(audio));
  }
});`,
};

export default function LandingPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>('python');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<CreateRoomResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const startRoom = async () => {
    setCreating(true);
    setError(null);
    try {
      const data = await createRoom({ defaultAgent: true });
      setRoom(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setCreating(false);
    }
  };

  const enterRoom = () => {
    if (!room) return;
    try {
      const url = new URL(room.joinUrl);
      router.push(url.pathname + url.search);
    } catch {
      router.push(room.joinUrl.startsWith('/') ? room.joinUrl : `/room/${room.roomId}`);
    }
  };

  const copyLink = async () => {
    if (!room) return;
    await navigator.clipboard.writeText(room.joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="rk-landing">
      <header className="rk-nav">
        <div className="rk-nav-brand">
          <Sparkles size={20} />
          <span>roomKit</span>
        </div>
        <nav className="rk-nav-links">
          <a href="#features">Features</a>
          <a href="#quickstart">Quickstart</a>
          <a href="#contribute">Contribute</a>
          <a href="https://github.com" className="rk-nav-gh" target="_blank" rel="noreferrer">
            <Github size={16} /> GitHub
          </a>
        </nav>
      </header>

      <section className="rk-hero">
        <span className="rk-pill"><Radio size={14} /> Apache 2.0 · Alpha</span>
        <h1>Voice & video rooms with AI agents built in.</h1>
        <p className="rk-lede">
          Hosted WebRTC SFU + a bundled AI host + a 10-line SDK for your own agents.
          One frame contract. <strong>16 kHz mono PCM, 640-byte 20 ms frames</strong>. Your code never touches WebRTC.
        </p>

        <div className="rk-cta-row">
          <button className="rk-btn rk-btn-primary" onClick={startRoom} disabled={creating}>
            {creating ? 'Spinning up…' : <>Try a live room <ArrowRight size={16} /></>}
          </button>
          <a className="rk-btn rk-btn-ghost" href="#quickstart">
            <Terminal size={16} /> See the SDK
          </a>
        </div>

        {error && <p className="rk-error">{error}</p>}

        {room && (
          <div className="rk-room-card">
            <div className="rk-room-card-head">
              <strong>Room ready:</strong> <code>{room.roomId}</code>
            </div>
            <div className="rk-room-card-row">
              <input readOnly value={room.joinUrl} className="rk-input" onFocus={(e) => e.currentTarget.select()} />
              <button className="rk-icon-btn" onClick={copyLink} aria-label="Copy share link">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <button className="rk-btn rk-btn-primary rk-room-enter" onClick={enterRoom}>
              <PlayCircle size={16} /> Enter the room
            </button>
          </div>
        )}
      </section>

      <section id="features" className="rk-features">
        <h2>What you get out of the box</h2>
        <div className="rk-feature-grid">
          <FeatureCard
            icon={<Layers size={20} />}
            title="Frozen wire contract"
            body="16 kHz mono PCM Int16 LE, 20 ms binary frames + JSON control on the same WebSocket. Mirror once, ship anywhere."
          />
          <FeatureCard
            icon={<Bot size={20} />}
            title="Bundled AI host"
            body="Silero VAD · Deepgram STT · GPT-4o-mini · ElevenLabs TTS. Set a systemPrompt, the agent joins and transcribes."
          />
          <FeatureCard
            icon={<Code size={20} />}
            title="BYO agent SDKs"
            body="callplatform (Python) + @roomkit/sdk (Node). Same surface: recv(), send(), events(). Ships a SimulatedRoom for offline tests."
          />
          <FeatureCard
            icon={<Radio size={20} />}
            title="Mixed or per-track audio"
            body="Pin the stream to one participant for diarization-aware agents. Add ?stream=per-track&participantId=… to the WS URL."
          />
          <FeatureCard
            icon={<ShieldCheck size={20} />}
            title="Multi-tenant, JWT-scoped"
            body="API keys bind to tenants. POST /v1/rooms/:id/tokens/sign returns a dual {gatewayToken, livekitToken} pair."
          />
          <FeatureCard
            icon={<Zap size={20} />}
            title="Supervised bridge"
            body="Bounded-restart subprocess wrapper. Bridge crashes? Respawn + recoverable error event — the SDK never sees a drop."
          />
        </div>
      </section>

      <section id="quickstart" className="rk-quickstart">
        <h2>Ten lines and you’re in a call.</h2>
        <p className="rk-sub">Same primitives in every language. Mock with SimulatedRoom; ship by swapping the URL.</p>

        <div className="rk-tabs">
          <button
            className={`rk-tab ${lang === 'python' ? 'rk-tab-active' : ''}`}
            onClick={() => setLang('python')}
          >
            Python
          </button>
          <button
            className={`rk-tab ${lang === 'node' ? 'rk-tab-active' : ''}`}
            onClick={() => setLang('node')}
          >
            Node · TypeScript
          </button>
        </div>

        <pre className="rk-snippet"><code>{SNIPPETS[lang]}</code></pre>

        <div className="rk-quickstart-shell">
          <div className="rk-shell-head">terminal</div>
          <pre className="rk-shell-body"><code>{`docker-compose -f infra/docker-compose.yml up -d
pnpm install && pnpm --filter @roomkit/shared build
pnpm dev                # gateway :3000 · web :3001`}</code></pre>
        </div>
      </section>

      <section id="contribute" className="rk-contribute">
        <h2>Contribute</h2>
        <p className="rk-sub">
          roomKit is built in lanes. Pick an open issue, branch from <code>main</code>, ship a focused PR.
          The wire contract is FROZEN — any change to <code>packages/shared/src/wire.ts</code> needs a
          coordinated version bump across every SDK.
        </p>
        <div className="rk-cta-row">
          <a className="rk-btn rk-btn-primary" href="https://github.com" target="_blank" rel="noreferrer">
            <Github size={16} /> View on GitHub
          </a>
          <a className="rk-btn rk-btn-ghost" href="https://github.com/issues" target="_blank" rel="noreferrer">
            Browse issues <ArrowRight size={16} />
          </a>
        </div>
        <ul className="rk-contrib-list">
          <li><strong>Good first issues:</strong> contributor guide, web landing polish, real LLM example.</li>
          <li><strong>Hard wins:</strong> inactivity auto-close, signed-URL helper, SIP ingress.</li>
          <li><strong>Bring your own:</strong> agent recipes, framework adapters, deployment templates.</li>
        </ul>
      </section>

      <footer className="rk-footer">
        <span>roomKit · Apache 2.0 · built with caveman energy.</span>
        <a href="https://github.com" target="_blank" rel="noreferrer">
          <Github size={14} /> source
        </a>
      </footer>
    </main>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rk-feature">
      <div className="rk-feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
