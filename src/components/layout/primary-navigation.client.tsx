"use client";

import { FiChevronDown } from "react-icons/fi";
import { IntentPrefetchLink } from "@/components/navigation/intent-prefetch-link.client";
import { useHeaderPathname } from "./header-route.client";
import { NavMenu, NavMenuLink } from "./nav-menu.client";

/**
 * Four top-level destinations, matching the landing nav's density and
 * typography. Everything account-shaped lives behind the avatar control in
 * `AccountMenu`; everything discovery-shaped groups under Explore.
 */
const exploreLinks = [
  { href: "/library", label: "MIDI Library" },
  { href: "/explore", label: "Projects" },
  { href: "/challenges", label: "Challenges" },
] as const;

function isExploreLinkCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isExploreCurrent(pathname: string) {
  return exploreLinks.some((link) => isExploreLinkCurrent(pathname, link.href));
}

function isStudioCurrent(pathname: string) {
  return pathname === "/studio" || pathname.startsWith("/studio/");
}

function topLevelClassName(current: boolean) {
  return `inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold tracking-[0.01em] whitespace-nowrap transition-colors ${current ? "text-accent" : "text-muted hover:text-accent"}`;
}

export function PrimaryNavigation() {
  const pathname = useHeaderPathname();
  const dashboardCurrent = pathname === "/dashboard";
  const exploreCurrent = isExploreCurrent(pathname);
  const studioCurrent = isStudioCurrent(pathname);

  return (
    <>
      <details className="border-subtle bg-surface-soft order-3 w-full rounded-3xl border p-2 sm:hidden">
        <summary className="min-h-11 cursor-pointer rounded-full px-4 py-3 font-semibold">
          Menu
        </summary>
        <nav aria-label="Primary mobile" className="mt-2 grid gap-1">
          <IntentPrefetchLink
            href="/dashboard"
            aria-current={dashboardCurrent ? "page" : undefined}
            className={`rounded-full px-4 py-2 font-medium ${dashboardCurrent ? "text-accent" : "text-muted"}`}
          >
            Dashboard
          </IntentPrefetchLink>
          <p className="text-muted px-4 pt-2 pb-1 font-mono text-[10.5px] tracking-[0.18em] uppercase">
            Explore
          </p>
          {exploreLinks.map((link) => {
            const current = isExploreLinkCurrent(pathname, link.href);
            return (
              <IntentPrefetchLink
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={`rounded-full px-4 py-2 font-medium ${current ? "text-accent" : "text-muted"}`}
              >
                {link.label}
              </IntentPrefetchLink>
            );
          })}
          <IntentPrefetchLink
            href="/studio"
            aria-current={studioCurrent ? "page" : undefined}
            className={`mt-1 rounded-full px-4 py-2 font-medium ${studioCurrent ? "text-accent" : "text-muted"}`}
          >
            Studio
          </IntentPrefetchLink>
        </nav>
      </details>

      <nav
        aria-label="Primary"
        className="order-3 hidden items-center gap-6 text-sm sm:order-2 sm:flex lg:gap-7"
      >
        <IntentPrefetchLink
          href="/dashboard"
          aria-current={dashboardCurrent ? "page" : undefined}
          className={topLevelClassName(dashboardCurrent)}
        >
          Dashboard
        </IntentPrefetchLink>
        <NavMenu
          label="Explore"
          triggerClassName={topLevelClassName(exploreCurrent)}
          triggerContent={({ open }) => (
            <>
              Explore
              <FiChevronDown
                aria-hidden="true"
                className={`text-base transition-transform ${open ? "rotate-180" : ""}`}
              />
            </>
          )}
        >
          {exploreLinks.map((link) => (
            <NavMenuLink
              key={link.href}
              href={link.href}
              current={isExploreLinkCurrent(pathname, link.href)}
            >
              {link.label}
            </NavMenuLink>
          ))}
        </NavMenu>
        <IntentPrefetchLink
          href="/studio"
          aria-current={studioCurrent ? "page" : undefined}
          className={topLevelClassName(studioCurrent)}
        >
          Studio
        </IntentPrefetchLink>
      </nav>
    </>
  );
}
