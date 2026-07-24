"use client";

import { FiChevronDown } from "react-icons/fi";
import { Avatar } from "@/components/ui/avatar";
import { signOut } from "@/features/auth/actions";
import type { ViewerIdentity } from "@/features/auth/use-viewer-identity.client";
import { useHeaderPathname } from "./header-route.client";
import { accountLinksForViewer, isAccountLinkCurrent } from "./nav-items";
import { NavMenu, NavMenuLink, NavMenuSeparator } from "./nav-menu.client";

/**
 * The account control is the viewer's own face rather than a labelled button,
 * which is what lets the signed-in header stay at four top-level items while
 * matching the landing nav's density. Below `sm` the mobile tab bar owns these
 * destinations, so this hides rather than competing with the Account tab.
 */
export function AccountMenu({ viewer }: { viewer: ViewerIdentity }) {
  const pathname = useHeaderPathname();
  const name = viewer.displayName ?? viewer.username ?? "Your account";
  const viewerLinks = accountLinksForViewer(viewer.username);

  return (
    <div className="order-2 hidden shrink-0 sm:order-3 sm:block">
      <NavMenu
        label="Account menu"
        align="end"
        panelClassName="w-72"
        triggerClassName="group inline-flex shrink-0 items-center gap-1.5 rounded-full pl-0.5 transition-colors"
        triggerContent={({ open }) => (
          <>
            <span
              className={`inline-flex rounded-full p-0.5 ring-1 transition-colors ${open ? "ring-accent" : "group-hover:ring-accent-2 ring-transparent"}`}
            >
              <Avatar
                avatarConfig={viewer.avatarConfig}
                name={name}
                size="sm"
                decorative
              />
            </span>
            <FiChevronDown
              aria-hidden="true"
              className={`text-muted group-hover:text-accent text-base transition-transform ${open ? "rotate-180" : ""}`}
            />
          </>
        )}
      >
        <div className="px-4 pt-2 pb-3">
          <p className="truncate text-sm font-semibold">{name}</p>
          {viewer.username && (
            <p className="text-muted truncate font-mono text-xs">
              @{viewer.username}
            </p>
          )}
        </div>
        <NavMenuSeparator />
        {viewerLinks.map((link) => (
          <NavMenuLink
            key={link.href}
            href={link.href}
            current={isAccountLinkCurrent(pathname, link.href)}
          >
            {link.label}
          </NavMenuLink>
        ))}
        <NavMenuSeparator />
        <form action={signOut}>
          <button
            type="submit"
            className="hover:bg-ink/[0.07] text-muted hover:text-danger flex min-h-11 w-full items-center rounded-full px-4 text-sm font-medium transition-colors"
          >
            Sign out
          </button>
        </form>
      </NavMenu>
    </div>
  );
}
