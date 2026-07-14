"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Wraps every route so navigations fade in smoothly. Opacity-only on purpose:
 * a `transform` here would reparent `position: fixed` overlays (the sign-in
 * modal, landing aurora, floating CTA) and break them.
 */
export default function Template({
  children,
}: Readonly<{ children: ReactNode }>) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: reduceMotion ? 0 : 0.35,
        ease: [0.2, 0.8, 0.2, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
