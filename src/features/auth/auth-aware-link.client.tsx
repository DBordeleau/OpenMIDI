"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type LinkState = {
  href: string;
  label: string;
};

export function AuthAwareLink({
  signedOut,
  signedIn,
  className,
  icon,
}: Readonly<{
  signedOut: LinkState;
  signedIn: LinkState;
  className?: string;
  /** Optional leading icon rendered before the label (same for both states). */
  icon?: ReactNode;
}>) {
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

  const state = isSignedIn ? signedIn : signedOut;
  return (
    <Link href={state.href} className={className}>
      {icon}
      {state.label}
    </Link>
  );
}
