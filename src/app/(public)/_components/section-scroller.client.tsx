"use client";

import { useEffect } from "react";

/**
 * Turns the landing's proximity snap into a full-page feel for the mouse wheel:
 * one wheel gesture (or a burst) glides to the next / previous section. Tall
 * sections aren't trapped — while there's still content of the current section
 * off the bottom (or top) edge, the wheel scrolls within it natively, and only
 * the gesture at the section's edge advances to the neighbour.
 *
 * Renders nothing; it just wires listeners onto the landing scroll container.
 * Touch and keyboard are intentionally left to native behaviour (hijacking
 * arrows would fight the diff scrubber's own keyboard handling).
 */
export function SectionScroller() {
  useEffect(() => {
    const container = document.querySelector<HTMLElement>(
      "[data-landing-scroll]",
    );
    if (!container) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // On touch the landing hands scrolling back to the document, so this
    // element is no longer the scroll port. Driving `scrollTop` on it would do
    // nothing except make every wheel event read section 0. Bail unless it is
    // genuinely scrollable.
    const overflowY = window.getComputedStyle(container).overflowY;
    if (overflowY !== "auto" && overflowY !== "scroll") return;

    const sections = Array.from(
      container.querySelectorAll<HTMLElement>("[data-snap]"),
    );
    if (sections.length < 2) return;

    let locked = false;
    let unlockTimer = 0;

    const currentIndex = () => {
      const st = container.scrollTop;
      let idx = 0;
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].offsetTop <= st + 4) idx = i;
      }
      return idx;
    };

    // Is there still meaningfully more of the current section past the edge we
    // are scrolling toward? If so, let the browser scroll within it.
    const moreWithinSection = (dir: number) => {
      const st = container.scrollTop;
      const sec = sections[currentIndex()];
      const top = sec.offsetTop;
      const bottom = top + sec.offsetHeight;
      // A jump settles a few px INTO the section (smooth-scroll / snap drift).
      // Downward that's harmless, but upward a tiny tolerance would read the
      // drift as "content above" and eat the first burst — so treat anything
      // within ~12% of the top edge as already at the top.
      if (dir > 0) return bottom > st + container.clientHeight + 8;
      return top < st - Math.max(24, container.clientHeight * 0.12);
    };

    const jumpBy = (dir: number) => {
      const cur = currentIndex();
      const target = Math.max(0, Math.min(sections.length - 1, cur + dir));
      if (target === cur) return;
      locked = true;
      container.scrollTo({
        top: sections[target].offsetTop,
        behavior: "smooth",
      });
      window.clearTimeout(unlockTimer);
      unlockTimer = window.setTimeout(() => {
        locked = false;
      }, 700);
    };

    const onWheel = (e: WheelEvent) => {
      // While a jump is animating, swallow the rest of the gesture/burst so it
      // resolves to exactly one section move.
      if (locked) {
        e.preventDefault();
        return;
      }
      if (Math.abs(e.deltaY) < 2) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      if (moreWithinSection(dir)) return; // native scroll within a tall section
      e.preventDefault();
      jumpBy(dir);
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
      window.clearTimeout(unlockTimer);
    };
  }, []);

  return null;
}
