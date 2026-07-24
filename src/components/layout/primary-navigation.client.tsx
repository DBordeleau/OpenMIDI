"use client";

import { FiChevronDown } from "react-icons/fi";
import { IntentPrefetchLink } from "@/components/navigation/intent-prefetch-link.client";
import { useHeaderPathname } from "./header-route.client";
import {
  exploreLinks,
  isDashboardCurrent,
  isExploreCurrent,
  isExploreLinkCurrent,
  isStudioCurrent,
} from "./nav-items";
import { NavMenu, NavMenuLink } from "./nav-menu.client";

function topLevelClassName(current: boolean) {
  return `inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold tracking-[0.01em] whitespace-nowrap transition-colors ${current ? "text-accent" : "text-muted hover:text-accent"}`;
}

/**
 * The pointer-sized rendering of the shared navigation. Below `sm` the mobile
 * tab bar carries the same destinations from the thumb zone, so this renders
 * nothing rather than duplicating them into a disclosure.
 */
export function PrimaryNavigation() {
  const pathname = useHeaderPathname();
  const dashboardCurrent = isDashboardCurrent(pathname);
  const exploreCurrent = isExploreCurrent(pathname);
  const studioCurrent = isStudioCurrent(pathname);

  return (
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
        panelClassName="w-60"
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
  );
}
