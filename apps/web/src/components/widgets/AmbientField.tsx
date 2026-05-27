'use client';

import React, { useEffect, useRef } from 'react';

/**
 * Ultra-low-cost ambient particle field that drifts behind the hero.
 * Pure canvas + rAF, ~40 particles, throttled to ~30 fps when hidden.
 * Adds depth without demanding GPU budget on lower-end machines.
 */
export function AmbientField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let raf = 0;
    let particles: Array<{ x: number; y: number; vx: number; vy: number; r: number; hue: number }> = [];

    const reset = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      particles = Array.from({ length: 42 }).map(() => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.25 * dpr,
        vy: (Math.random() - 0.5) * 0.2 * dpr,
        r: (1 + Math.random() * 1.5) * dpr,
        hue: Math.random() < 0.6 ? 264 : 192, // violet vs cyan
      }));
    };
    reset();
    const ro = new ResizeObserver(reset);
    ro.observe(canvas);

    const tick = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // soft connection lines for nearby particles
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        a.x += a.vx;
        a.y += a.vy;
        if (a.x < 0 || a.x > w) a.vx *= -1;
        if (a.y < 0 || a.y > h) a.vy *= -1;
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120 * dpr) {
            ctx.strokeStyle = `hsla(${a.hue}, 80%, 65%, ${(1 - dist / (120 * dpr)) * 0.07})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue}, 80%, 70%, 0.55)`;
        ctx.shadowColor = `hsla(${p.hue}, 80%, 70%, 0.7)`;
        ctx.shadowBlur = 8;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="rk-ambient" aria-hidden="true" />;
}
