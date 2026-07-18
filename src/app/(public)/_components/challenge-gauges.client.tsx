"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import type { CanonicalChallengeConstraintsV1 } from "@/features/challenges/constraint-v1";
import { describeChallengeConstraintsV1 } from "@/features/challenges/constraint-v1";
import styles from "./landing.module.css";

type Gauge = { label: ReactNode; value: ReactNode; fill: number };

// The live constraint check for the example entry. Percentages drive the bar
// widths; the labels lean into restrictive, competitive framing.
const EXAMPLE_GAUGES: Gauge[] = [
  {
    label: "tracks ≤ 2",
    value: (
      <>
        <b>2</b> / 2
      </>
    ),
    fill: 100,
  },
  {
    label: "duration ≤ 1:00",
    value: (
      <>
        <b>0:47</b> / 1:00
      </>
    ),
    fill: 78,
  },
  {
    label: "notes ≤ 64",
    value: (
      <>
        <b>58</b> / 64
      </>
    ),
    fill: 91,
  },
  { label: "key = C minor", value: <b>C minor</b>, fill: 100 },
  {
    label: "tempo 120–128",
    value: (
      <>
        <b>124</b> BPM
      </>
    ),
    fill: 50,
  },
];

/**
 * The challenge ticket body: constraint gauges that fill, staggered, when they
 * scroll into view, then a "inside the lines" stamp lands — so the reader sees
 * the entry being measured live against the week's limits.
 */
export function ChallengeGauges({
  constraints,
}: {
  constraints?: CanonicalChallengeConstraintsV1;
}) {
  const gauges: Gauge[] = useMemo(
    () =>
      constraints
        ? describeChallengeConstraintsV1(constraints)
            .slice(0, 5)
            .map((rule, index) => ({
              label: `rule ${String(index + 1).padStart(2, "0")}`,
              value: <b>{rule}</b>,
              fill: 100,
            }))
        : EXAMPLE_GAUGES,
    [constraints],
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fillRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const stampRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timers: number[] = [];

    const run = () => {
      gauges.forEach((g, i) => {
        timers.push(
          window.setTimeout(
            () => {
              const f = fillRefs.current[i];
              const row = rowRefs.current[i];
              if (f) f.style.width = g.fill + "%";
              if (row) row.classList.add(styles.pass);
            },
            reduce ? 0 : 120 + i * 140,
          ),
        );
      });
      timers.push(
        window.setTimeout(
          () => stampRef.current?.classList.add(styles.on),
          reduce ? 0 : 160 + gauges.length * 140,
        ),
      );
    };

    let io: IntersectionObserver | null = null;
    if (reduce || !("IntersectionObserver" in window)) {
      run();
    } else {
      io = new IntersectionObserver(
        (es) => {
          es.forEach((e) => {
            if (e.isIntersecting) {
              run();
              io?.disconnect();
            }
          });
        },
        { threshold: 0.35 },
      );
      io.observe(wrap);
    }

    return () => {
      io?.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [gauges]);

  return (
    <div ref={wrapRef} className={styles.ticketBody}>
      {gauges.map((g, i) => (
        <div
          key={i}
          className={styles.gauge}
          ref={(el) => {
            rowRefs.current[i] = el;
          }}
        >
          <div className={styles.gaugeTop}>
            <span className={styles.gaugeL}>{g.label}</span>
            <span className={styles.gaugeV}>{g.value}</span>
          </div>
          <div className={styles.gaugeBar}>
            <span
              className={styles.gaugeFill}
              ref={(el) => {
                fillRefs.current[i] = el;
              }}
            />
          </div>
        </div>
      ))}

      <div className={styles.stamp}>
        <span className={styles.left}></span>
        <span className={styles.right}>
          <span ref={stampRef} className={styles.stampOk}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 8.5l3.2 3.2L13 5"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Submissions automatically checked for eligibility
          </span>
        </span>
      </div>
    </div>
  );
}
