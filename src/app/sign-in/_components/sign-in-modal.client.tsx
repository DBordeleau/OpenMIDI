"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { FiX } from "react-icons/fi";

/**
 * Presents the sign-in card as a focused modal over the app shell, with a warm
 * scale/fade entrance and a graceful fade-out that returns the visitor home.
 */
export function SignInModal({ children }: Readonly<{ children: ReactNode }>) {
  const [open, setOpen] = useState(true);
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <AnimatePresence onExitComplete={() => router.push("/")}>
      {open && (
        <motion.div
          key="sign-in"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.28 }}
        >
          <div
            aria-hidden="true"
            onClick={close}
            className="bg-canvas/70 absolute inset-0 backdrop-blur-md"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="signin-title"
            // The same glass the nav sheets and dashboard cards use, so signing
            // in looks like the room you are about to walk into.
            className="dash-card dash-card-lit rounded-card relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-7 sm:max-h-[calc(100dvh-3rem)] sm:p-9"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }
            }
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close and return home"
              className="text-muted hover:text-accent hover:border-accent border-strong absolute top-5 right-5 grid h-9 w-9 place-items-center rounded-full border transition-colors"
            >
              <FiX aria-hidden="true" />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
