"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";
import {
  useViewerIdentity,
  type ViewerIdentity,
} from "@/features/auth/use-viewer-identity.client";

const SIGNED_OUT: ViewerIdentity = {
  signedIn: false,
  displayName: null,
  username: null,
  avatarConfig: null,
};

const ViewerIdentityContext = createContext<ViewerIdentity | null>(null);

/**
 * Resolves the display-only viewer identity once for all shared navigation.
 *
 * The header and the mobile tab bar both need a face and a signed-in flag. Each
 * calling the hook would double the claim check and the `public_profiles` read
 * on every navigation, which the request-bounded navigation rule in AGENTS.md
 * rules out. Sitting above both keeps it to one.
 *
 * Living above the header's exit animation is safe because the hook's updates
 * are non-destructive: a revalidation that finds the same profile returns the
 * same object, so the animating header never re-renders mid-flight.
 */
export function ViewerIdentityProvider({ children }: { children: ReactNode }) {
  const viewer = useViewerIdentity(usePathname());
  return (
    <ViewerIdentityContext.Provider value={viewer}>
      {children}
    </ViewerIdentityContext.Provider>
  );
}

/** Falls back to the signed-out shell so navigation renders without a provider. */
export function useViewer(): ViewerIdentity {
  return useContext(ViewerIdentityContext) ?? SIGNED_OUT;
}
