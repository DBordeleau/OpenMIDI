"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";

/** Routes where `ConditionalHeader` hides the shared header entirely. */
export function isStudioRoute(pathname: string) {
  return pathname === "/studio" || pathname.startsWith("/studio/");
}

const HeaderRouteContext = createContext<string | null>(null);

/**
 * Freezes the route the header renders for while it animates away.
 *
 * Entering the Studio removes the header behind a 340ms slide-away, but the
 * subtree stays mounted and live for that whole animation. Reading the live
 * pathname there made the nav restyle itself mid-exit: the Studio link lit up,
 * the identity effect re-ran and blanked the avatar back to initials, and any
 * open panel slammed shut — all at full opacity, which read as a flicker.
 * Leaving the Studio never showed it, because there the header mounts fresh and
 * is already in its final state; that asymmetry was the whole bug.
 *
 * The fix leans on `AnimatePresence`, which renders the *previous* element for
 * an exiting key. Because this provider sits inside that element, its `pathname`
 * prop is captured at the last render where the header was visible, and every
 * consumer below keeps seeing that route until the exit finishes. Nothing needs
 * to track history — the animation library already does.
 */
export function HeaderRouteProvider({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  return (
    <HeaderRouteContext.Provider value={pathname}>
      {children}
    </HeaderRouteContext.Provider>
  );
}

/**
 * The route the shared header should render for. Falls back to the live
 * pathname so header components stay usable outside the animated wrapper.
 */
export function useHeaderPathname() {
  const frozen = useContext(HeaderRouteContext);
  const live = usePathname();
  return frozen ?? live;
}
