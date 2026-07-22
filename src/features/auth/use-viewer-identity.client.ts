"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  parseAvatarConfig,
  type AvatarConfigV1,
} from "@/features/profiles/avatar/contract";

export type ViewerIdentity = {
  signedIn: boolean;
  displayName: string | null;
  username: string | null;
  avatarConfig: AvatarConfigV1 | null;
};

const SIGNED_OUT: ViewerIdentity = {
  signedIn: false,
  displayName: null,
  username: null,
  avatarConfig: null,
};

type Client = ReturnType<typeof createSupabaseBrowserClient>;

/**
 * Reads the safe public projection so the header can show a face. Any failure —
 * an incomplete profile that is not publicly visible yet, or a projection that
 * is unavailable — degrades to initials instead of blocking the header.
 */
async function readPublicIdentity(supabase: Client, viewerId: string) {
  try {
    const { data } = await supabase
      .from("public_profiles")
      .select("username,display_name,avatar_config")
      .eq("id", viewerId)
      .maybeSingle();
    if (!data) return null;
    return {
      displayName: data.display_name,
      username: data.username,
      avatarConfig: parseAvatarConfig(data.avatar_config),
    };
  } catch {
    return null;
  }
}

/**
 * Display-only viewer identity for the shared navigation. It progressively
 * enhances the signed-out shell from verified browser claims and never acts as
 * an authorization boundary; every real permission decision still happens in a
 * service or data boundary (AGENTS.md).
 *
 * `revalidateOn` re-checks the claim when it changes — the caller passes a
 * route key, because a server-side sign-out redirect clears the cookie without
 * the browser client ever firing an auth event. Revalidation is deliberately
 * non-destructive: it never blanks a face that is already on screen.
 */
export function useViewerIdentity(revalidateOn: string): ViewerIdentity {
  const [identity, setIdentity] = useState<ViewerIdentity>(SIGNED_OUT);

  useEffect(() => {
    let active = true;
    let supabase: Client;

    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return;
    }

    async function refreshClaims() {
      const { data, error } = await supabase.auth.getClaims();
      const viewerId = error ? undefined : data?.claims?.sub;
      if (!viewerId) {
        if (active) setIdentity(SIGNED_OUT);
        return;
      }
      // Show the account control as soon as the claim is verified; the face
      // fills in on the next tick rather than delaying the whole header. A
      // viewer who is already signed in keeps the face they have — replacing it
      // with the empty state would flash initials on every revalidation.
      if (active)
        setIdentity((current) =>
          current.signedIn ? current : { ...SIGNED_OUT, signedIn: true },
        );
      const profile = await readPublicIdentity(supabase, viewerId);
      if (active && profile)
        setIdentity((current) =>
          JSON.stringify(current.avatarConfig) ===
            JSON.stringify(profile.avatarConfig) &&
          current.username === profile.username &&
          current.displayName === profile.displayName
            ? current
            : { signedIn: true, ...profile },
        );
    }

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      queueMicrotask(() => void refreshClaims());
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [revalidateOn]);

  return identity;
}
