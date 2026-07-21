"use client";

import { IntentPrefetchLink } from "@/components/navigation/intent-prefetch-link.client";
import { AccountMenu } from "./account-menu.client";
import { PrimaryNavigation } from "./primary-navigation.client";
import { useViewer } from "./viewer-identity-provider.client";

const sectionLinks = [
  { href: "/library", label: "The MIDI Library" },
  { href: "/#versioning", label: "Versioning" },
  { href: "/challenges", label: "Challenges" },
] as const;

/**
 * The header adapts to auth state, and both states share the landing nav's
 * shape: quiet 13px links on the left of the action, one pill-or-avatar control
 * on the right.
 *
 * On a phone the header steps back to identity and sign-in only — the tab bar
 * carries navigation from the thumb zone, so the workspace nav and the account
 * menu are pointer-only, and the marketing section links (which matter when a
 * visitor jumps to a landing section from another route) hide rather than
 * wrapping onto a second row.
 */
export function HeaderNav() {
  const viewer = useViewer();

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
        className="order-3 hidden min-w-0 items-center gap-5 sm:order-2 sm:flex lg:gap-7"
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
        className="border-strong text-ink hover:border-accent hover:text-accent order-2 inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-[13px] font-semibold transition-all hover:-translate-y-px sm:order-3 sm:min-h-11"
      >
        Sign in
      </IntentPrefetchLink>
    </>
  );
}
