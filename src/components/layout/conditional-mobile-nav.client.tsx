"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { IntentPrefetchLink } from "@/components/navigation/intent-prefetch-link.client";
import { HeaderRouteProvider, isStudioRoute } from "./header-route.client";
import { MobileTabBar } from "./mobile-tab-bar.client";
import { useViewer } from "./viewer-identity-provider.client";

/** Routes that carry their own bottom-of-screen action or nav. */
function hidesMobileNav(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/sign-in" ||
    pathname === "/onboarding" ||
    pathname.startsWith("/auth/") ||
    isStudioRoute(pathname)
  );
}

/**
 * The mobile counterpart to `ConditionalHeader`.
 *
 * Signed-in visitors get the four-tab thumb bar; signed-out visitors get a
 * single join action instead, because a nav they cannot use is worse than no
 * nav (docs/design/brand.md §5). The landing ships its own CTAs, sign-in and
 * onboarding are the action, and the Studio is a full-viewport window — all of
 * those opt out entirely.
 *
 * The bar slides away on the way into the Studio for the same reason the header
 * does, and reads its route through `HeaderRouteProvider` so the exiting copy
 * does not restyle itself mid-animation.
 */
export function ConditionalMobileNav() {
  const pathname = usePathname();
  const viewer = useViewer();
  const reduce = useReducedMotion();
  const hidden = hidesMobileNav(pathname);

  return (
    <>
      {/* Fixed chrome would otherwise cover the end of the page. */}
      {!hidden && <div aria-hidden="true" className="h-20 sm:hidden" />}
      <AnimatePresence initial={false}>
        {!hidden && (
          <motion.div
            key="mobile-nav"
            initial={reduce ? { opacity: 0 } : { y: "110%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "110%" }}
            transition={{
              duration: reduce ? 0.15 : 0.34,
              ease: [0.2, 0.8, 0.2, 1],
            }}
            className="sm:hidden"
          >
            <HeaderRouteProvider pathname={pathname}>
              {viewer.signedIn ? <MobileTabBar /> : <SignedOutDock />}
            </HeaderRouteProvider>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function SignedOutDock() {
  return (
    <div className="border-subtle bg-canvas/90 pb-safe fixed inset-x-0 bottom-0 z-40 border-t px-4 pt-3 backdrop-blur-xl sm:hidden">
      <IntentPrefetchLink
        href="/sign-in"
        className="cta-gradient text-accent-contrast flex min-h-12 items-center justify-center rounded-full text-base font-bold"
      >
        Join the beta
      </IntentPrefetchLink>
    </div>
  );
}
