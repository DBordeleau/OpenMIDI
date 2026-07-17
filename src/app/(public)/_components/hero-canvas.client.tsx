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
  rr,
} from "./canvas-utils";
import styles from "./landing.module.css";

/**
 * The hero background: a real four-voice arrangement over sixteen bars, drawn
 * across the whole viewport. A playhead sweeps and lights each note as it
 * sounds — notes sit bright at rest and bloom when struck, then release on
 * their own envelope so tails keep fading after the sweep wraps.
 */
export function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;

    const STEPS = 64;
    const ROWS = 30;

    // Built from a repeating musical figure so it reads as music, not noise.
    // `lit` is a per-note envelope, not a function of playhead distance — that
    // is what lets a note keep releasing after the sweep has moved on.
    const notes: { s: number; l: number; r: number; c: string; lit: number }[] =
      [];
    const add = (s: number, l: number, r: number, c: string) =>
      notes.push({ s, l, r, c, lit: 0 });
    const prog = [0, 0, -3, -3, -5, -5, -1, -1, 0, 0, -3, -3, 2, 2, -5, -5];
    for (let bar = 0; bar < 16; bar++) {
      const s = bar * 4;
      const p = prog[bar];
      // bass — root, then a push
      add(s, 2, 25 + (p === -5 ? 1 : 0), BERRY);
      add(s + 2, 1, 25 + (p === -5 ? 1 : 0), BERRY);
      if (bar % 4 === 3) add(s + 3, 1, 24, BERRY);
      // keys — a triad, offset per bar
      [0, 3, 5].forEach((iv, k) => {
        add(s + (k === 2 ? 1 : 0), k === 2 ? 3 : 2, 18 - iv + p, CORAL);
      });
      add(s + 2, 2, 16 + p, CORAL);
      // lead — motif on alternate bars
      if (bar % 2 === 0) {
        add(s + 1, 1, 9 + p, GOLD);
        add(s + 2, 1, 7 + p, GOLD);
        add(s + 3, 1, 8 + p, GOLD);
      } else if (bar % 4 === 1) {
        add(s, 2, 6 + p, GOLD);
      }
      // pad — long tones
      if (bar % 4 === 0) add(s, 8, 2 + (p === 0 ? 0 : 1), PLUM);
    }

    let W = 0;
    let H = 0;
    let ctx: CanvasRenderingContext2D | null = null;
    const size = () => {
      const r = fit(cv);
      if (!r) return;
      W = r.w;
      H = r.h;
      ctx = r.c;
    };
    size();
    if (!ctx) return;

    const observer =
      "ResizeObserver" in window ? new ResizeObserver(size) : null;
    observer?.observe(cv);

    const cw = () => W / STEPS;
    const rh = () => H / ROWS;

    const frame = (hx: number) => {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      // grid — bars only, very faint
      for (let s = 0; s <= STEPS; s += 4) {
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(s * cw()) + 0.5, 0);
        ctx.lineTo(Math.round(s * cw()) + 0.5, H);
        ctx.stroke();
      }
      notes.forEach((n) => {
        const x = n.s * cw();
        const y = n.r * rh();
        const w = Math.max(4, n.l * cw() - 3);
        const h = Math.max(4, rh() - 3);
        ctx!.save();
        // Notes sit bright at rest and bloom when struck.
        ctx!.globalAlpha = 0.78 + n.lit * 0.22;
        // Constant radius, fading opacity — decays smoothly to nothing.
        ctx!.shadowColor = rgba(n.c, n.lit * 0.9);
        ctx!.shadowBlur = 26;
        ctx!.fillStyle = n.c;
        rr(ctx!, x, y, w, h, 3);
        ctx!.fill();
        ctx!.restore();
      });
      if (hx >= 0) {
        ctx.save();
        const g = ctx.createLinearGradient(hx - 60, 0, hx, 0);
        g.addColorStop(0, "rgba(255,200,121,0)");
        g.addColorStop(1, "rgba(255,200,121,0.13)");
        ctx.fillStyle = g;
        ctx.fillRect(hx - 60, 0, 60, H);
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = GOLD;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(hx, 0);
        ctx.lineTo(hx, H);
        ctx.stroke();
        ctx.restore();
      }
    };

    if (prefersReducedMotion()) {
      notes.forEach((n) => (n.lit = 0));
      frame(-1);
      return () => observer?.disconnect();
    }

    const SWEEP = 11000;
    const ATTACK = 0.07; // seconds to reach full brightness once struck
    const RELEASE = 0.75; // seconds to decay ~63% — long enough to read as a tail
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
      const hx = (((now - t0) % SWEEP) / SWEEP) * W;

      const decay = Math.exp(-dt / RELEASE);
      notes.forEach((n) => {
        const x = n.s * cw();
        const w = Math.max(4, n.l * cw() - 3);
        const sounding = hx >= x && hx <= x + w;
        // Sustain while the head is over the note, then release on its own.
        if (sounding) n.lit = Math.min(1, n.lit + dt / ATTACK);
        else n.lit *= decay;
      });

      frame(hx);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className={styles.field}
      role="img"
      aria-label="A wide piano roll filling the screen, playing a four-part arrangement. A playhead sweeps across and lights each note as it sounds."
    />
  );
}
