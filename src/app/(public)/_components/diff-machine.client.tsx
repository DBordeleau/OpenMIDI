"use client";

import { useEffect, useRef } from "react";
import { Reveal } from "@/components/ui/reveal.client";
import { CORAL, fit, GOLD, MUTED, rgba, rr } from "./canvas-utils";
import styles from "./landing.module.css";

type Note = [step: number, len: number, row: number];
type Change =
  | { k: "keep"; a: Note; b: Note }
  | { k: "move"; a: Note; b: Note }
  | { k: "del"; a: Note }
  | { k: "add"; b: Note };

/**
 * The version-diff "time machine". Notes physically travel from version 2 to
 * version 3 as you drag; nothing is left to read. The scrub is continuous, the
 * three stat buttons each play their own stage, and playback runs at one shared
 * rate so a third of the bar always takes the same wall-clock time.
 */
export function DiffMachine() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const revARef = useRef<HTMLSpanElement>(null);
  const revBRef = useRef<HTMLSpanElement>(null);
  const stageRef = useRef<HTMLParagraphElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    const scrub = scrubRef.current;
    const fill = fillRef.current;
    const revA = revARef.current;
    const revB = revBRef.current;
    const stage = stageRef.current;
    if (!cv || !scrub || !fill || !revA || !revB) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const STEPS = 16;
    const ROWS = 12;
    // a = v2, b = v3.
    const D: Change[] = [
      { k: "keep", a: [0, 2, 8], b: [0, 2, 8] },
      { k: "keep", a: [2, 2, 7], b: [2, 2, 7] },
      { k: "del", a: [4, 1, 9] },
      { k: "move", a: [5, 2, 6], b: [6, 2, 5] },
      { k: "move", a: [8, 2, 6], b: [9, 2, 6] },
      { k: "keep", a: [10, 2, 8], b: [10, 2, 8] },
      { k: "del", a: [12, 1, 9] },
      { k: "move", a: [13, 2, 7], b: [14, 2, 6] },
      { k: "add", b: [4, 2, 3] },
      { k: "add", b: [6, 1, 2] },
      { k: "add", b: [7, 1, 1] },
      { k: "add", b: [12, 2, 2] },
      { k: "keep", a: [0, 4, 10], b: [0, 4, 10] },
      { k: "keep", a: [8, 4, 10], b: [8, 4, 10] },
    ];

    let W = 0;
    let H = 0;
    let ctx: CanvasRenderingContext2D | null = null;
    const PAD = 12;
    const cw = () => (W - PAD * 2) / STEPS;
    const rh = () => (H - PAD * 2) / ROWS;
    const ease = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
    // stage boundaries: v2 | removed | changed | added/v3
    const BOUND = [0, 1 / 3, 2 / 3, 1];

    type Box = { x: number; y: number; w: number; h: number };
    const pos = (p: Note): Box => ({
      x: PAD + p[0] * cw(),
      y: PAD + p[2] * rh(),
      w: Math.max(4, p[1] * cw() - 3),
      h: Math.max(4, rh() - 4),
    });
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    let visT = 0;
    let raf: number | null = null;

    function draw(t: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      // grid
      for (let r = 0; r < ROWS; r++) {
        if (r % 2) continue;
        ctx.fillStyle = "rgba(255,255,255,0.022)";
        ctx.fillRect(PAD, PAD + r * rh(), W - PAD * 2, rh());
      }
      for (let s = 0; s <= STEPS; s++) {
        ctx.strokeStyle =
          s % 4 === 0 ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.045)";
        ctx.beginPath();
        ctx.moveTo(Math.round(PAD + s * cw()) + 0.5, PAD);
        ctx.lineTo(Math.round(PAD + s * cw()) + 0.5, H - PAD);
        ctx.stroke();
      }

      const label = (box: Box, glyph: string, alpha: number, dark: boolean) => {
        if (!glyph || box.w <= 13 || alpha <= 0.3) return;
        ctx!.save();
        ctx!.globalAlpha = alpha;
        ctx!.fillStyle = dark ? "#2a1310" : "#8d7a86";
        ctx!.font = "700 9px Consolas, ui-monospace, monospace";
        ctx!.textAlign = "center";
        ctx!.textBaseline = "middle";
        ctx!.fillText(glyph, box.x + box.w / 2, box.y + box.h / 2 + 0.5);
        ctx!.restore();
      };

      /* The change happens in order — remove, then move, then add — and each
         stage owns exactly one third of the scrub. The phases butt up against
         each other with no gaps, so a detent is a real boundary. */
      const removePhase = seg(t, BOUND[0], BOUND[1]);
      const movePhase = ease(seg(t, BOUND[1], BOUND[2]));
      const addPhase = seg(t, BOUND[2], BOUND[3]);

      D.forEach((n) => {
        /* A removed note genuinely EXISTS at v2 — so at t=0 it is drawn solid,
           just marked. It dissolves into the dashed outline, and that outline
           STAYS: at v3 it is the evidence something was here. */
        if (n.k === "del") {
          const box = pos(n.a);
          const solid = 1 - removePhase;
          if (solid > 0.002) {
            ctx!.save();
            ctx!.globalAlpha = solid;
            ctx!.fillStyle = MUTED;
            rr(ctx!, box.x, box.y, box.w, box.h, 3);
            ctx!.fill();
            ctx!.restore();
            label(box, "−", solid, true);
          }
          if (removePhase > 0.002) {
            ctx!.save();
            ctx!.globalAlpha = removePhase * 0.95;
            ctx!.setLineDash([3, 3]);
            ctx!.strokeStyle = "#8d7a86";
            ctx!.lineWidth = 1;
            rr(ctx!, box.x, box.y, box.w, box.h, 3);
            ctx!.stroke();
            ctx!.restore();
            label(box, "−", removePhase * 0.9, false);
          }
          return;
        }

        let box: Box;
        let colour: string;
        let alpha = 1;
        let glyph = "";
        if (n.k === "keep") {
          box = pos(n.a);
          colour = "rgba(255,141,99,0.4)";
        } else if (n.k === "move") {
          const A = pos(n.a);
          const B = pos(n.b);
          box = {
            x: lerp(A.x, B.x, movePhase),
            y: lerp(A.y, B.y, movePhase),
            w: lerp(A.w, B.w, movePhase),
            h: A.h,
          };
          colour = CORAL;
          glyph = "~";
        } else {
          box = pos(n.b);
          colour = GOLD;
          glyph = "+";
          alpha = addPhase;
          if (alpha <= 0.002) return;
        }

        ctx!.save();
        ctx!.globalAlpha = alpha;
        if (n.k === "add") {
          ctx!.shadowColor = rgba(GOLD, alpha * 0.8);
          ctx!.shadowBlur = 18;
          const s = 0.72 + 0.28 * alpha;
          const cx = box.x + box.w / 2;
          const cy = box.y + box.h / 2;
          box = {
            x: cx - (box.w * s) / 2,
            y: cy - (box.h * s) / 2,
            w: box.w * s,
            h: box.h * s,
          };
        }
        if (n.k === "move" && movePhase > 0.02 && movePhase < 0.98) {
          ctx!.shadowColor = rgba(CORAL, 0.8);
          ctx!.shadowBlur = 14;
        }
        ctx!.fillStyle = colour;
        rr(ctx!, box.x, box.y, box.w, box.h, 3);
        ctx!.fill();
        ctx!.restore();

        label(box, glyph, alpha, true);
      });
    }

    const size = () => {
      const r = fit(cv);
      if (!r) return;
      W = r.w;
      H = r.h;
      ctx = r.c;
      draw(visT);
    };

    const stats = statsRef.current
      ? Array.from(
          statsRef.current.querySelectorAll<HTMLButtonElement>("[data-stop]"),
        )
      : [];
    const NAMES = ["Removing 2 notes", "Changing 3 notes", "Adding 4 notes"];

    /* One playback rate for everything; the scrub position moves LINEARLY —
       all the easing lives inside the notes, where you can actually read it. */
    const FULL_MS = 4800;

    function chrome(t: number) {
      fill!.style.width = t * 100 + "%";
      revA!.classList.toggle(styles.on, t < 0.5);
      revB!.classList.toggle(styles.on, t >= 0.5);
      const i = t >= BOUND[2] ? 2 : t >= BOUND[1] ? 1 : 0;
      // aria-live: only touch the node when the words actually change.
      const name =
        t <= 0.001 ? "Version 2" : t >= 0.999 ? "Version 3" : NAMES[i];
      if (stage && stage.textContent !== name) stage.textContent = name;
      stats.forEach((b) =>
        b.classList.toggle(styles.on, Number(b.dataset.stop) === i + 1),
      );
    }
    function render(t: number) {
      visT = t;
      scrub!.value = String(t);
      draw(t);
      chrome(t);
    }
    function halt() {
      if (raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    }
    // Play from → to at the shared rate. Interruptible: any drag halts it.
    function play(from: number, to: number) {
      halt();
      const dur = Math.abs(to - from) * FULL_MS;
      if (reduce || dur < 16) {
        render(to);
        return;
      }
      let s: number | null = null;
      raf = requestAnimationFrame(function run(now) {
        if (s === null) s = now;
        const p = Math.min(1, (now - s) / dur);
        render(from + (to - from) * p);
        raf = p < 1 ? requestAnimationFrame(run) : null;
      });
    }

    size();
    const observer =
      "ResizeObserver" in window ? new ResizeObserver(size) : null;
    observer?.observe(cv);
    render(0);

    // Dragging is direct — the handle goes exactly where the pointer is.
    const onInput = () => {
      halt();
      render(Number(scrub.value));
    };
    scrub.addEventListener("input", onInput);

    /* A stage button plays ITS stage: rewind to where the change begins and
       run to where it ends — showing the change, not just its aftermath. */
    const onStat = (b: HTMLButtonElement) => () => {
      const k = Number(b.dataset.stop);
      render(BOUND[k - 1]);
      play(BOUND[k - 1], BOUND[k]);
    };
    const statHandlers = stats.map((b) => {
      const h = onStat(b);
      b.addEventListener("click", h);
      return [b, h] as const;
    });

    // Play the whole change through once, in order, when it comes into view.
    let io: IntersectionObserver | null = null;
    if (!reduce && "IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (es) => {
          es.forEach((e) => {
            if (!e.isIntersecting) return;
            io?.disconnect();
            play(0, 1);
          });
        },
        { threshold: 0.45 },
      );
      io.observe(cv);
    } else if (reduce) {
      render(1);
    }

    return () => {
      halt();
      observer?.disconnect();
      io?.disconnect();
      scrub.removeEventListener("input", onInput);
      statHandlers.forEach(([b, h]) => b.removeEventListener("click", h));
    };
  }, []);

  return (
    <div className={styles.wrap}>
      <div className={styles.diffHead}>
        <div className={styles.head} style={{ maxWidth: "44rem" }}>
          <Reveal as="div">
            <p className={styles.kicker}>Legible history</p>
          </Reveal>
          <Reveal delay={0.06}>
            <h2>
              Revisions laid <em className={styles.em}>bare</em>.
            </h2>
          </Reveal>
          <Reveal delay={0.12}>
            <p className={styles.lede}>
              Visualize every change. Drag the handle and watch version 2 become
              version 3. See every note that moved, arrived or left.
            </p>
          </Reveal>
        </div>
        <Reveal delay={0.18}>
          <div ref={statsRef}>
            <p className={styles.statCap}>
              What changed · v2 → v3 · click one to play it
            </p>
            <div className={styles.statRow}>
              <button
                type="button"
                className={`${styles.stat} ${styles.sDel}`}
                data-stop="1"
              >
                <span className={styles.statN}>2</span>
                <span className={styles.statL}>Removed</span>
              </button>
              <button
                type="button"
                className={`${styles.stat} ${styles.sMov}`}
                data-stop="2"
              >
                <span className={styles.statN}>3</span>
                <span className={styles.statL}>Changed</span>
              </button>
              <button
                type="button"
                className={`${styles.stat} ${styles.sAdd}`}
                data-stop="3"
              >
                <span className={styles.statN}>4</span>
                <span className={styles.statL}>Added</span>
              </button>
            </div>
          </div>
        </Reveal>
      </div>

      <Reveal delay={0.12}>
        <div className={styles.machine}>
          <canvas
            ref={canvasRef}
            className={styles.diff}
            role="img"
            aria-label="A piano roll morphing between version 2 and version 3 of the Lead track: four notes are added, three move later, two are removed."
          />
          <div className={styles.rail}>
            <span ref={revARef} className={`${styles.rev} ${styles.on}`}>
              version 2
            </span>
            <span className={styles.slot}>
              <span className={styles.trackLine} />
              <span ref={fillRef} className={styles.trackFill} />
              <span className={styles.stops} aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              <input
                ref={scrubRef}
                className={styles.scrub}
                type="range"
                min="0"
                max="1"
                step="0.001"
                defaultValue="0"
                aria-label="Scrub the change from version 2 to version 3"
              />
            </span>
            <span ref={revBRef} className={styles.rev}>
              version 3
            </span>
          </div>
          <p ref={stageRef} className={styles.stageName} aria-live="polite">
            Version 2
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.12}>
        <div className={styles.legend}>
          <span className={styles.lg}>
            <i style={{ background: "var(--gold)" }}>+</i> added in v3
          </span>
          <span className={styles.lg}>
            <i style={{ background: "var(--coral)" }}>~</i> changed in v3
          </span>
          <span className={styles.lg}>
            <i
              style={{
                border: "1px dashed var(--faint)",
                color: "var(--faint)",
              }}
            >
              −
            </i>{" "}
            deleted in v3
          </span>
        </div>
      </Reveal>
    </div>
  );
}
