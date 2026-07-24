"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { HeaderRouteProvider, isStudioRoute } from "./header-route.client";
import { SiteHeader } from "./site-header";

/**
 * The marketing landing ("/") ships its own transparent nav that bleeds over
 * the hero canvas, so the shared sticky header would double up there — it is
 * swapped instantly, with no animation to reconcile.
 *
 * The Studio hides the site nav entirely: it renders as a single full-viewport
 * glass window like desktop DAW software, and its own top bar carries
 * navigation back out. That removal is *animated* on purpose. The header slides
 * up and collapses its height so the reclaimed space is visibly handed to the
 * timeline, which is the only cue that explains why the nav vanished; leaving
 * the Studio plays it in reverse. Reduced motion gets a plain cross-fade, and
 * the sticky positioning lives on this wrapper (not on `SiteHeader`) so the
 * collapsing element is the one that sticks.
 *
 * This component tracks the *real* pathname because it decides when to remove
 * the header. Everything inside it must not: the exiting subtree stays mounted
 * and live for the whole animation, so it reads the route through
 * `HeaderRouteProvider`/`useHeaderPathname` instead — see that module for why
 * rendering the new route mid-exit looked like a flicker.
 */
export function ConditionalHeader() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  // Clipping is only correct mid-collapse: at rest the header must let the
  // Explore and account dropdown panels escape its own box.
  const [collapsing, setCollapsing] = useState(false);

  if (pathname === "/" || pathname === "/sign-in") return null;

  const collapsed = { height: 0, opacity: 0, y: -18 };

  return (
    <AnimatePresence initial={false}>
      {!isStudioRoute(pathname) && (
        <motion.div
          key="site-header"
          className={`sticky top-0 z-30 ${collapsing ? "overflow-hidden" : ""}`}
          initial={reduce ? { opacity: 0 } : collapsed}
          animate={{ height: "auto", opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : collapsed}
          transition={{
            duration: reduce ? 0.15 : 0.34,
            ease: [0.2, 0.8, 0.2, 1],
          }}
          onAnimationStart={() => setCollapsing(true)}
          onAnimationComplete={() => setCollapsing(false)}
        >
          <HeaderRouteProvider pathname={pathname}>
            <SiteHeader />
          </HeaderRouteProvider>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
