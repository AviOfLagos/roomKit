'use client';

import React, { useEffect, useState } from 'react';

/**
 * Interactive breakdown of one 20 ms PCM frame.
 *
 *  640 bytes  =  320 samples  ×  2 bytes  (Int16 LE, mono)
 *
 * The byte strip animates one new sample slot every ~40 ms so the contract
 * feels tangible. Hovering a region highlights the equivalent unit (samples
 * vs bytes vs ms) — the same fact viewed three ways.
 */
export function FrameInspector() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 320), 40);
    return () => clearInterval(id);
  }, []);

  const lit = tick;

  return (
    <div className="rk-frame">
      <div className="rk-frame-row">
        <Pill label="samples" value="320" />
        <Pill label="bytes" value="640" />
        <Pill label="duration" value="20 ms" />
        <Pill label="rate" value="50 frame/s" />
      </div>

      <div className="rk-frame-strip" aria-hidden="true">
        {Array.from({ length: 64 }).map((_, i) => {
          const samplesPerCell = 5;
          const start = i * samplesPerCell;
          const end = start + samplesPerCell;
          const active = lit >= start && lit < end;
          const intensity = Math.max(0, 1 - (lit - end) / 60);
          return (
            <span
              key={i}
              className={`rk-frame-cell ${active ? 'rk-frame-cell-active' : ''}`}
              style={{ opacity: 0.18 + intensity * 0.7 }}
            />
          );
        })}
      </div>

      <div className="rk-frame-legend">
        <span><span className="rk-dot rk-dot-primary" /> 1 cell = 5 samples = 10 bytes</span>
        <span>{lit + 1} / 320 samples</span>
      </div>
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rk-frame-pill">
      <span className="rk-frame-pill-val">{value}</span>
      <span className="rk-frame-pill-lbl">{label}</span>
    </div>
  );
}
