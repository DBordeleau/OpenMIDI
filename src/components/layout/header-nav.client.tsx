"use client";

import { IntentPrefetchLink } from "@/components/navigation/intent-prefetch-link.client";
import { useViewerIdentity } from "@/features/auth/use-viewer-identity.client";
import { AccountMenu } from "./account-menu.client";
import { useHeaderPathname } from "./header-route.client";
import { PrimaryNavigation } from "./primary-navigation.client";

const sectionLinks = [
  { href: "/library", label: "The MIDI Library" },
  { href: "/#versioning", label: "Versioning" },
  { href: "/challenges", label: "Challenges" },
] as const;

/**
 * The header adapts to auth state, but both states now share the landing nav's
 * shape: quiet 13px links on the left of the action, one pill-or-avatar control
 * on the right. Signed-out visitors get the marketing sections (these matter
 * when a visitor jumps to a landing section from another route, since the
 * landing ships its own nav); signed-in members get the workspace navigation
 * plus the avatar account menu.
 */
export function HeaderNav() {
  const viewer = useViewerIdentity(useHeaderPathname());

  if (viewer.signedIn) {
    return (
      <>
        <PrimaryNavigation />
        <AccountMenu viewer={viewer} />
      </>
    );
  }

  return (
    <>
      <nav
        aria-label="Sections"
        className="order-3 flex w-full min-w-0 items-center gap-5 overflow-x-auto sm:order-2 sm:w-auto lg:gap-7"
      >
        {sectionLinks.map((link) => (
          <IntentPrefetchLink
            key={link.href}
            href={link.href}
            className="text-muted hover:text-accent inline-flex min-h-11 items-center text-[13px] font-semibold tracking-[0.01em] whitespace-nowrap transition-colors"
          >
            {link.label}
          </IntentPrefetchLink>
        ))}
      </nav>
      <IntentPrefetchLink
        href="/sign-in"
        className="border-strong text-ink hover:border-accent hover:text-accent order-2 inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-[13px] font-semibold transition-all hover:-translate-y-px sm:order-3"
      >
        Sign in
      </IntentPrefetchLink>
    </>
  );
}
