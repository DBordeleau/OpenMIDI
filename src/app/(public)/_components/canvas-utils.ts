/**
 * Shared 2D-canvas helpers for the landing's animated backgrounds. Extracted
 * from the approved OpenMIDI landing mockup so the hero, the version-diff
 * machine, and the radial close all draw notes and glows identically.
 */

// Brand colours, as literals, for canvas fills where a CSS custom property
// can't reach. Kept in sync with the palette in globals.css / brand.md.
export const CORAL = "#ff8d63";
export const GOLD = "#ffc879";
export const BERRY = "#e77aa6";
export const PLUM = "#b98ad6";
export const MUTED = "#c6adb4";

/**
 * A glow fades by losing OPACITY, never by shrinking its radius — a blur that
 * shrinks just tightens into a hard halo and then has to be cut off, which
 * reads as a snap. Radius stays put; only alpha moves. Returns an rgba() string
 * for a `#rrggbb` hex at the given alpha.
 */
export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Trace a rounded rectangle path (does not fill or stroke). */
export function rr(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rad = Math.max(0, Math.min(r, h / 2, w / 2));
  c.beginPath();
  c.moveTo(x + rad, y);
  c.arcTo(x + w, y, x + w, y + h, rad);
  c.arcTo(x + w, y + h, x, y + h, rad);
  c.arcTo(x, y + h, x, y, rad);
  c.arcTo(x, y, x + w, y, rad);
  c.closePath();
}

/**
 * Size a canvas to its layout box at device-pixel resolution (capped at 2x)
 * and return CSS-pixel dimensions plus a ready-to-draw context. Guards against
 * a missing 2D context so callers can bail cleanly.
 */
export function fit(
  cv: HTMLCanvasElement,
): { w: number; h: number; c: CanvasRenderingContext2D } | null {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = cv.getBoundingClientRect();
  cv.width = Math.max(1, Math.round(r.width * dpr));
  cv.height = Math.max(1, Math.round(r.height * dpr));
  const c = cv.getContext("2d");
  if (!c) return null;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w: r.width, h: r.height, c };
}

/** True when the visitor asked the OS to reduce motion. SSR-safe. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
