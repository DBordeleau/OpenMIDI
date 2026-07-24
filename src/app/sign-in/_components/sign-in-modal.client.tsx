"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { FiX } from "react-icons/fi";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type SignInPresentation = "direct" | "intercepted";

/**
 * Owns only the dialog lifecycle. The sign-in copy and server action stay in
 * the shared server-renderable `SignInContent` child.
 */
export function SignInModal({
  children,
  presentation,
}: Readonly<{
  children: ReactNode;
  presentation: SignInPresentation;
}>) {
  const [open, setOpen] = useState(true);
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = requestAnimationFrame(() =>
      closeButtonRef.current?.focus(),
    );

    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const finishClose = useCallback(() => {
    if (presentation === "direct") {
      router.push("/");
      return;
    }

    const opener = openerRef.current;
    router.back();
    requestAnimationFrame(() => opener?.focus());
  }, [presentation, router]);

  const trapFocus = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter((element) => !element.hasAttribute("hidden"));
    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable.at(-1);
    if (!last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  const dismissBackdrop = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) close();
    },
    [close],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close]);

  return (
    <AnimatePresence onExitComplete={finishClose}>
      {open && (
        <motion.div
          key="sign-in"
          data-sign-in-backdrop
          className="bg-canvas/70 fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain p-4 backdrop-blur-md sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.24 }}
          onPointerDown={dismissBackdrop}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="signin-title"
            tabIndex={-1}
            onKeyDown={trapFocus}
            // The same glass the nav sheets and dashboard cards use, so signing
            // in looks like the room the visitor is about to walk into.
            className="dash-card dash-card-lit rounded-card relative my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-7 sm:max-h-[calc(100dvh-3rem)] sm:p-9"
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 14 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }
            }
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 0.36, ease: [0.2, 0.8, 0.2, 1] }
            }
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={close}
              aria-label={
                presentation === "intercepted"
                  ? "Close sign in"
                  : "Close and return home"
              }
              title={
                presentation === "intercepted"
                  ? "Close sign in"
                  : "Close and return home"
              }
              className="text-muted hover:text-accent hover:border-accent border-strong absolute top-4 right-4 grid h-12 w-12 place-items-center rounded-full border transition-colors sm:top-5 sm:right-5"
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
