"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { PrimaryNavigation } from "./primary-navigation.client";

const sectionLinks = [
  { href: "/explore", label: "Explore" },
  { href: "/#how", label: "How it works" },
  { href: "/#console", label: "The studio" },
  { href: "/#credits", label: "Credits" },
] as const;

/**
 * The header adapts to auth state: signed-out visitors get the marketing shell
 * (section links that smooth-scroll the landing page), while signed-in members
 * get the app's primary workspace navigation.
 */
export function HeaderNav() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;

    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return;
    }

    async function refreshClaims() {
      const { data, error } = await supabase.auth.getClaims();
      if (active) setIsSignedIn(!error && Boolean(data?.claims?.sub));
    }

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      queueMicrotask(() => void refreshClaims());
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [pathname]);

  if (isSignedIn) {
    return (
      <>
        <PrimaryNavigation />
        <Link
          href="/settings/profile"
          className="cta-gradient text-accent-contrast order-2 hidden min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-transform hover:-translate-y-px sm:order-3 sm:inline-flex"
        >
          Account
        </Link>
      </>
    );
  }

  return (
    <>
      <nav
        aria-label="Sections"
        className="order-3 flex w-full min-w-0 items-center gap-1 overflow-x-auto text-sm sm:order-2 sm:w-auto"
      >
        {sectionLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-muted hover:text-accent rounded-full px-3 py-2 font-medium whitespace-nowrap transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <Link
        href="/sign-in"
        className="border-strong text-ink hover:border-accent hover:text-accent order-2 inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition-colors sm:order-3 sm:px-5"
      >
        Sign in
      </Link>
    </>
  );
}
