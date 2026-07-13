"use client";

import { useEffect, useState } from "react";
import { AuthAwareLink } from "@/features/auth/auth-aware-link.client";

/**
 * Persistent, salient sign-up action that follows the reader down the page so
 * they can start creating from any point on the landing page.
 */
export function FloatingCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = window.setTimeout(() => setShow(true), reduce ? 0 : 700);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      aria-label="Join Jam Session"
      className={`border-strong bg-surface-raised/80 fixed right-6 bottom-6 z-40 flex items-center gap-3.5 rounded-full border p-[9px] pl-5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.75)] backdrop-blur-lg transition-all duration-500 ease-out max-[600px]:inset-x-4 max-[600px]:justify-center ${
        show ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
      }`}
    >
      <span className="text-muted text-[13px] max-[600px]:hidden">
        <span className="text-ink font-semibold">Ready to jam?</span>
      </span>
      <AuthAwareLink
        signedOut={{ href: "/sign-in", label: "Join the beta" }}
        signedIn={{ href: "/projects/new", label: "Create something" }}
        className="cta-gradient inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition-transform duration-200 hover:-translate-y-px max-[600px]:flex-1"
      />
    </div>
  );
}
