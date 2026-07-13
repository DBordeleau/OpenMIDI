"use client";

import { useEffect, useRef } from "react";

const TRACKS: readonly { c: string; off: number }[] = [
  { c: "#ff8d63", off: 0 },
  { c: "#ffb07a", off: 1.3 },
  { c: "#ffc879", off: 2.6 },
  { c: "#e77aa6", off: 3.9 },
];

/**
 * The hero centerpiece: four collaborator lanes rendered as a living,
 * animated multi-track waveform with a sweeping playhead.
 */
export function HeroWaveform() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;

    const size = () => {
      const w = canvas.clientWidth || canvas.parentElement?.clientWidth || 0;
      const h = canvas.clientHeight || 260;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    window.addEventListener("resize", size);

    const padTop = 46;
    const padBot = 22;

    const frame = (t: number) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight || 260;
      ctx.clearRect(0, 0, w, h);
      const rowH = (h - padTop - padBot) / TRACKS.length;
      TRACKS.forEach((tr, ri) => {
        const cy = padTop + rowH * ri + rowH / 2;
        const bars = Math.floor(w / 6);
        const bw = w / bars;
        for (let i = 0; i < bars; i++) {
          const ph = t / 720 + tr.off;
          const amp =
            Math.sin(i * 0.28 + ph) * 0.5 + Math.sin(i * 0.11 - ph * 0.6) * 0.5;
          const env = Math.sin((i / bars) * Math.PI);
          const bh = Math.max(2, Math.abs(amp) * env * (rowH * 0.42));
          ctx.fillStyle = tr.c;
          ctx.globalAlpha = 0.5;
          ctx.fillRect(i * bw + 1, cy - bh, bw - 2, bh * 2);
        }
      });
      ctx.globalAlpha = 1;
      const px = ((t / 3600) % 1) * w;
      ctx.fillStyle = "rgba(255,240,225,0.85)";
      ctx.fillRect(px, padTop - 8, 1.5, h - padTop - padBot + 16);
      ctx.fillStyle = "rgba(255,200,121,0.95)";
      ctx.beginPath();
      ctx.arc(px, padTop - 8, 3, 0, 7);
      ctx.fill();
      if (!reduce) raf = window.requestAnimationFrame(frame);
    };

    if (reduce) frame(1200);
    else raf = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
    };
  }, []);

  return (
    <div className="border-subtle relative overflow-hidden rounded-[22px] border bg-[linear-gradient(180deg,var(--color-surface-raised),var(--color-surface-soft))] shadow-[0_40px_100px_-50px_#000]">
      <div className="text-muted pointer-events-none absolute inset-x-5 top-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10.5px] tracking-[0.14em] uppercase">
        <span className="text-accent-2 flex items-center gap-2">
          <span className="bg-accent-2 h-[7px] w-[7px] rounded-full shadow-[0_0_10px_var(--color-accent-2)]" />
          Live mix
        </span>
        <span>4 collaborators</span>
        <span>124 BPM · Am</span>
        <span className="text-ink ml-auto">Midnight Loop</span>
      </div>
      <canvas
        ref={ref}
        aria-hidden="true"
        className="block h-[clamp(220px,32vw,300px)] w-full"
      />
    </div>
  );
}
