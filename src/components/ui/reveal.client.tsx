"use client";

import { motion, useReducedMotion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

type RevealTag =
  "div" | "section" | "article" | "header" | "aside" | "ul" | "li";

/**
 * Fade-and-rise entrance used across the app. Animates on scroll-into-view
 * (once); above-the-fold content animates on mount. Stagger sibling groups by
 * passing an increasing `delay`. Use `as` to keep semantic markup (e.g. a
 * staggered `as="li"` inside a real `<ul>`).
 */
export function Reveal({
  as = "div",
  delay = 0,
  className,
  style,
  children,
  id,
  "aria-labelledby": ariaLabelledby,
  "aria-label": ariaLabel,
}: Readonly<{
  as?: RevealTag;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  id?: string;
  "aria-labelledby"?: string;
  "aria-label"?: string;
}>) {
  const reduceMotion = useReducedMotion();
  const Component = motion[as];
  return (
    <Component
      id={id}
      aria-labelledby={ariaLabelledby}
      aria-label={ariaLabel}
      className={className}
      style={style}
      initial={reduceMotion ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.6, ease: [0.2, 0.8, 0.2, 1], delay }
      }
    >
      {children}
    </Component>
  );
}
