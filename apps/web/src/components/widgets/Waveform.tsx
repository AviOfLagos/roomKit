'use client';

import React, { useEffect, useRef } from 'react';

/**
 * Hero PCM oscilloscope. Synthesises a realistic-looking 16 kHz mono
 * Int16 LE waveform on the fly — voice-shaped envelope with multi-band
 * formants and gentle randomness. Rendered into a canvas at 60 fps so the
 * 640-byte frame contract feels like a living signal, not marketing copy.
 *
 * Pure presentational. No real audio capture.
 */
export function Waveform({ height = 160 }: { height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const tRef = useRef(0);
  const speechRef = useRef(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Background grid — 20 ms ticks across the visible scope window.
      const tickEvery = w / 32;
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 32; i++) {
        const x = i * tickEvery;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Envelope: simulate speech bursts of ~600 ms separated by 200 ms silence.
      const t = (tRef.current += 1);
      const phase = (t * 0.012) % 1;
      const env = phase < 0.75 ? Math.sin(phase * Math.PI * 1.33) : 0;
      speechRef.current = speechRef.current * 0.9 + env * 0.1;
      const speech = speechRef.current;

      // Waveform — sum of 4 formants + noise, amplitude shaped by speech envelope.
      const points: number[] = [];
      const N = Math.floor(w);
      for (let x = 0; x < N; x++) {
        const u = x / N;
        const f1 = Math.sin(u * 18 + t * 0.18);
        const f2 = Math.sin(u * 40 + t * 0.07) * 0.5;
        const f3 = Math.sin(u * 65 + t * 0.04) * 0.25;
        const noise = (Math.random() - 0.5) * 0.15;
        const sample = (f1 + f2 + f3 + noise) * 0.35 * (0.15 + speech);
        points.push(sample);
      }

      // Glow stroke
      const grd = ctx.createLinearGradient(0, 0, w, 0);
      grd.addColorStop(0, '#7c3aed');
      grd.addColorStop(0.55, '#22d3ee');
      grd.addColorStop(1, '#7c3aed');
      ctx.lineWidth = 2 * dpr;
      ctx.strokeStyle = grd;
      ctx.shadowColor = '#7c3aed';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      for (let x = 0; x < N; x++) {
        const y = h / 2 + points[x] * (h / 2);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Frame markers — vertical pulses every "20 ms" tick where speech is loud.
      ctx.fillStyle = 'rgba(124, 58, 237, 0.18)';
      const frameW = w / 16;
      for (let i = 0; i < 16; i++) {
        const x = i * frameW;
        const local = Math.sin((t + i * 6) * 0.04) * 0.5 + 0.5;
        if (local * speech > 0.45) {
          ctx.fillRect(x, h * 0.1, 2 * dpr, h * 0.8);
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="rk-wave" style={{ height }}>
      <canvas ref={canvasRef} className="rk-wave-canvas" />
      <div className="rk-wave-meta">
        <span>16 kHz</span>
        <span>mono</span>
        <span>Int16 LE</span>
        <span>20 ms</span>
        <span>640 B / frame</span>
      </div>
    </div>
  );
}
