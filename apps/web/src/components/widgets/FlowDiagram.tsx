'use client';

import React, { useEffect, useRef, useState } from 'react';

type Lane = 'human' | 'agent' | 'sfu' | 'gateway' | 'byo';

const NODES: Record<Lane, { x: number; y: number; label: string; sub: string }> = {
  human:   { x:  60, y:  60, label: 'Human',       sub: 'web client' },
  agent:   { x: 540, y:  60, label: 'Default AI',  sub: 'livekit-agents' },
  sfu:     { x: 300, y: 160, label: 'LiveKit SFU', sub: 'WebRTC, hidden' },
  gateway: { x: 300, y: 260, label: 'Gateway',     sub: 'REST + WS bridge' },
  byo:     { x: 300, y: 360, label: 'BYO agent',   sub: '@roomkit/sdk · callplatform' },
};

const FLOWS: Array<{ from: Lane; to: Lane; color: string; label: string }> = [
  { from: 'human',   to: 'sfu',     color: '#22d3ee', label: 'WebRTC' },
  { from: 'agent',   to: 'sfu',     color: '#22d3ee', label: 'WebRTC' },
  { from: 'sfu',     to: 'gateway', color: '#a78bfa', label: 'server bridge' },
  { from: 'gateway', to: 'byo',     color: '#f472b6', label: '640 B PCM frames' },
];

/**
 * Animated architecture diagram. Particles travel along each connection,
 * representing the audio packets streaming through the platform. Renders
 * in SVG with CSS keyframes so it's GPU-accelerated and accessible.
 */
export function FlowDiagram() {
  const [tick, setTick] = useState(0);
  const reqRef = useRef<number | null>(null);

  useEffect(() => {
    let last = performance.now();
    const loop = (now: number) => {
      if (now - last > 60) {
        last = now;
        setTick((t) => (t + 1) % 1000);
      }
      reqRef.current = requestAnimationFrame(loop);
    };
    reqRef.current = requestAnimationFrame(loop);
    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, []);

  return (
    <div className="rk-flow">
      <svg viewBox="0 0 600 420" preserveAspectRatio="xMidYMid meet" className="rk-flow-svg">
        <defs>
          <linearGradient id="rkFlowGradWebrtc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
            <stop offset="50%" stopColor="#22d3ee" stopOpacity="1" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rkFlowGradBridge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0" />
            <stop offset="50%" stopColor="#a78bfa" stopOpacity="1" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rkFlowGradByo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f472b6" stopOpacity="0" />
            <stop offset="50%" stopColor="#f472b6" stopOpacity="1" />
            <stop offset="100%" stopColor="#f472b6" stopOpacity="0" />
          </linearGradient>
          <filter id="rkGlow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Edges */}
        {FLOWS.map((f, idx) => {
          const a = NODES[f.from];
          const b = NODES[f.to];
          return (
            <g key={idx}>
              <line
                x1={a.x + 60} y1={a.y + 30} x2={b.x + 60} y2={b.y + 30}
                stroke="rgba(255,255,255,0.08)" strokeWidth={1.5}
              />
              {/* Particles travelling along the edge */}
              {[0, 0.33, 0.66].map((offset) => {
                const phase = ((tick / 60) + offset) % 1;
                const px = a.x + 60 + (b.x - a.x) * phase;
                const py = a.y + 30 + (b.y - a.y) * phase;
                return (
                  <circle
                    key={offset}
                    cx={px} cy={py} r={3}
                    fill={f.color} opacity={0.9}
                    filter="url(#rkGlow)"
                  />
                );
              })}
              <text
                x={(a.x + b.x) / 2 + 60}
                y={(a.y + b.y) / 2 + 26}
                fontSize="10"
                fill="rgba(255,255,255,0.45)"
                textAnchor="middle"
                fontFamily="ui-monospace, SFMono-Regular, monospace"
              >
                {f.label}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {Object.entries(NODES).map(([k, n]) => (
          <g key={k} transform={`translate(${n.x},${n.y})`}>
            <rect
              width="120" height="60" rx="10"
              fill="#15151a" stroke="rgba(255,255,255,0.08)" strokeWidth={1}
            />
            <text x="60" y="26" textAnchor="middle" fontSize="13" fontWeight="600" fill="#fafafa">
              {n.label}
            </text>
            <text x="60" y="44" textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.5)">
              {n.sub}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
