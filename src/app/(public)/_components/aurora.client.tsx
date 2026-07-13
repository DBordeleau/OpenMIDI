"use client";

import { useEffect, useRef } from "react";

type Blob = {
  x: number;
  y: number;
  r: number;
  c: [number, number, number];
  p: number;
};

const BLOBS: readonly Blob[] = [
  { x: 0.16, y: 0.1, r: 0.44, c: [255, 141, 99], p: 0 },
  { x: 0.84, y: 0.16, r: 0.4, c: [255, 200, 121], p: 2 },
  { x: 0.62, y: 0.52, r: 0.48, c: [231, 122, 166], p: 4 },
  { x: 0.28, y: 0.74, r: 0.4, c: [255, 141, 99], p: 1.5 },
];

/**
 * Ambient warm aurora painted behind the landing page. Fixed to the viewport
 * and pinned below content (-z-10) so the glow drifts as the page scrolls.
 */
export function Aurora() {
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
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    window.addEventListener("resize", size);

    const frame = (t: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const b of BLOBS) {
        const cx = (b.x + Math.sin(t / 6500 + b.p) * 0.05) * w;
        const cy = (b.y + Math.cos(t / 7500 + b.p) * 0.05) * h;
        const rr = b.r * Math.max(w, h) * 0.9;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
        g.addColorStop(0, `rgba(${b.c[0]},${b.c[1]},${b.c[2]},0.26)`);
        g.addColorStop(1, `rgba(${b.c[0]},${b.c[1]},${b.c[2]},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, 7);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      if (!reduce) raf = window.requestAnimationFrame(frame);
    };

    if (reduce) frame(0);
    else raf = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-screen w-screen opacity-70"
    />
  );
}
