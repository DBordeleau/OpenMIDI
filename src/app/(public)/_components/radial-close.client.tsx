"use client";

import { useEffect, useRef } from "react";
import {
  BERRY,
  CORAL,
  fit,
  GOLD,
  PLUM,
  prefersReducedMotion,
  rgba,
} from "./canvas-utils";
import styles from "./landing.module.css";

/**
 * The closing background, drawn as the loop it describes: a radial sequencer
 * where angle is time and each concentric ring is a voice. A single clean sweep
 * hand rotates through one turn, lighting arcs with the same attack/release
 * envelope as the hero. The closing message sits in the hole at the centre.
 */
export function RadialClose() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;

    const STEPS = 32;
    const TAU = Math.PI * 2;
    const GAP = 0.014; // angular breathing room between notes
    const mk = (a: [number, number][]) => a.map(([s, l]) => ({ s, l, lit: 0 }));

    // four voices, outermost = the pad holding it all together
    const rings = [
      {
        rad: 0.6,
        w: 0.08,
        c: BERRY,
        n: mk([
          [0, 3],
          [4, 2],
          [8, 3],
          [12, 2],
          [16, 3],
          [20, 2],
          [24, 3],
          [28, 3],
        ]),
      },
      {
        rad: 0.73,
        w: 0.068,
        c: CORAL,
        n: mk([
          [0, 2],
          [3, 1],
          [6, 2],
          [10, 2],
          [16, 2],
          [19, 1],
          [22, 2],
          [26, 2],
        ]),
      },
      {
        rad: 0.85,
        w: 0.056,
        c: GOLD,
        n: mk([
          [2, 1],
          [3, 1],
          [11, 2],
          [18, 1],
          [19, 1],
          [27, 2],
        ]),
      },
      {
        rad: 0.96,
        w: 0.04,
        c: PLUM,
        n: mk([
          [0, 11],
          [16, 11],
        ]),
      },
    ];

    let W = 0;
    let H = 0;
    let ctx: CanvasRenderingContext2D | null = null;
    let R = 0;
    let cx = 0;
    let cy = 0;
    const size = () => {
      const r = fit(cv);
      if (!r) return;
      W = r.w;
      H = r.h;
      ctx = r.c;
      cx = W / 2;
      cy = H / 2;
      R = Math.min(W, H) * 0.47;
    };
    size();
    if (!ctx) return;

    const observer =
      "ResizeObserver" in window ? new ResizeObserver(size) : null;
    observer?.observe(cv);

    const ang = (step: number) => (step / STEPS) * TAU - Math.PI / 2;

    const frame = (phase: number, dt: number | null) => {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      const head = phase * STEPS;

      rings.forEach((ring) => {
        const radius = R * ring.rad;
        const lw = Math.max(3, R * ring.w);

        ctx!.save();
        ctx!.strokeStyle = "rgba(255,255,255,0.035)";
        ctx!.lineWidth = lw;
        ctx!.beginPath();
        ctx!.arc(cx, cy, radius, 0, TAU);
        ctx!.stroke();
        ctx!.restore();

        ring.n.forEach((n) => {
          if (dt !== null) {
            const sounding = head >= n.s && head <= n.s + n.l;
            if (sounding) n.lit = Math.min(1, n.lit + dt / 0.06);
            else n.lit *= Math.exp(-dt / 0.9);
          }
          ctx!.save();
          ctx!.globalAlpha = 0.5 + n.lit * 0.5;
          ctx!.shadowColor = rgba(ring.c, n.lit * 0.95);
          ctx!.shadowBlur = 30;
          ctx!.strokeStyle = ring.c;
          ctx!.lineWidth = lw;
          ctx!.beginPath();
          ctx!.arc(cx, cy, radius, ang(n.s) + GAP, ang(n.s + n.l) - GAP);
          ctx!.stroke();
          ctx!.restore();
        });
      });

      // One clean hand, no wake. The notes' own release envelopes already show
      // where it has been — a trail just says it twice.
      const a = ang(head);
      const inner = R * 0.52;
      const outer = R * 1.02;
      ctx.save();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = rgba(GOLD, 0.9);
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
      ctx.stroke();
      ctx.restore();
    };

    if (prefersReducedMotion()) {
      rings.forEach((r) =>
        r.n.forEach((n, i) => (n.lit = i % 3 === 0 ? 0.7 : 0)),
      );
      frame(0.18, null);
      return () => observer?.disconnect();
    }

    const REV = 14000; // one turn of the loop
    let t0: number | null = null;
    let last: number | null = null;
    let raf = 0;
    const loop = (now: number) => {
      if (t0 === null) {
        t0 = now;
        last = now;
      }
      const dt = Math.min(0.05, (now - last!) / 1000);
      last = now;
      frame(((now - t0) % REV) / REV, dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, []);

  return <canvas ref={ref} className={styles.closeField} aria-hidden="true" />;
}
