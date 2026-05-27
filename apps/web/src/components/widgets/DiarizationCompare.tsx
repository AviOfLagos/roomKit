'use client';

import React, { useEffect, useState } from 'react';

type Speaker = 'alice' | 'bob' | 'carol';
const COLORS: Record<Speaker, string> = {
  alice: '#7c3aed',
  bob: '#22d3ee',
  carol: '#f472b6',
};

/** Hand-tuned conversation pattern: alternating speakers with brief overlaps. */
const SCRIPT: Array<{ at: number; len: number; who: Speaker }> = [
  { at: 0,   len: 7,  who: 'alice' },
  { at: 8,   len: 5,  who: 'bob' },
  { at: 14,  len: 6,  who: 'alice' },
  { at: 22,  len: 4,  who: 'carol' },
  { at: 25,  len: 5,  who: 'bob' },        // overlap
  { at: 32,  len: 6,  who: 'alice' },
  { at: 40,  len: 4,  who: 'carol' },
  { at: 46,  len: 5,  who: 'bob' },
  { at: 52,  len: 8,  who: 'alice' },
];

const TOTAL = 64;

/**
 * Side-by-side visualisation of `?stream=mixed` (one combined lane) vs
 * `?stream=per-track&participantId=...` (three separate lanes you can
 * pin individually). The bars animate in as if a real call is unfolding.
 */
export function DiarizationCompare() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => (x + 1) % (TOTAL + 12)), 120);
    return () => clearInterval(id);
  }, []);

  const visible = (cell: number) => cell < t;

  return (
    <div className="rk-diar">
      <div className="rk-diar-col">
        <div className="rk-diar-head">
          <code>?stream=mixed</code>
          <span className="rk-diar-sub">one downmix lane</span>
        </div>
        <Lane>
          {Array.from({ length: TOTAL }).map((_, i) => {
            const active = SCRIPT.some((s) => i >= s.at && i < s.at + s.len);
            const speakers = SCRIPT.filter((s) => i >= s.at && i < s.at + s.len);
            const color = speakers.length === 0
              ? 'rgba(255,255,255,0.04)'
              : speakers.length > 1
                ? '#fafafa'
                : COLORS[speakers[0].who];
            return (
              <Cell
                key={i}
                color={visible(i) && active ? color : 'rgba(255,255,255,0.04)'}
                tall
              />
            );
          })}
        </Lane>
        <div className="rk-diar-foot">
          One stream. Overlaps collide into a single waveform.
        </div>
      </div>

      <div className="rk-diar-col">
        <div className="rk-diar-head">
          <code>?stream=per-track</code>
          <span className="rk-diar-sub">one lane per pinned speaker</span>
        </div>
        {(['alice', 'bob', 'carol'] as Speaker[]).map((who) => (
          <Lane key={who} label={who}>
            {Array.from({ length: TOTAL }).map((_, i) => {
              const seg = SCRIPT.find((s) => s.who === who && i >= s.at && i < s.at + s.len);
              return (
                <Cell
                  key={i}
                  color={visible(i) && seg ? COLORS[who] : 'rgba(255,255,255,0.04)'}
                />
              );
            })}
          </Lane>
        ))}
        <div className="rk-diar-foot">
          Three sockets, three clean streams. Diarization-aware agents prefer this.
        </div>
      </div>
    </div>
  );
}

function Lane({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="rk-diar-lane">
      {label && <span className="rk-diar-lane-label">{label}</span>}
      <div className="rk-diar-lane-cells">{children}</div>
    </div>
  );
}

function Cell({ color, tall }: { color: string; tall?: boolean }) {
  return (
    <span
      className={`rk-diar-cell ${tall ? 'rk-diar-cell-tall' : ''}`}
      style={{ background: color }}
    />
  );
}
