"use client";

import { FiChevronDown } from "react-icons/fi";
import { Avatar } from "@/components/ui/avatar";
import { signOut } from "@/features/auth/actions";
import type { ViewerIdentity } from "@/features/auth/use-viewer-identity.client";
import { useHeaderPathname } from "./header-route.client";
import { NavMenu, NavMenuLink, NavMenuSeparator } from "./nav-menu.client";

const accountLinks = [
  {
    href: "/projects",
    label: "My projects",
    active: (pathname: string) =>
      pathname === "/projects" ||
      (pathname.startsWith("/projects/") &&
        pathname !== "/projects/new" &&
        !pathname.endsWith("/studio") &&
        !pathname.includes("/contributions")),
  },
  {
    href: "/library/saved",
    label: "Saved clips",
    active: (pathname: string) => pathname === "/library/saved",
  },
  {
    href: "/contributions",
    label: "Contributions",
    active: (pathname: string) =>
      pathname === "/contributions" ||
      (pathname.startsWith("/projects/") &&
        pathname.includes("/contributions")),
  },
  {
    href: "/settings/profile",
    label: "Edit profile",
    active: (pathname: string) => pathname === "/settings/profile",
  },
] as const;

/**
 * The account control is the viewer's own face rather than a labelled button,
 * which is what lets the signed-in header stay at four top-level items while
 * matching the landing nav's density.
 */
export function AccountMenu({ viewer }: { viewer: ViewerIdentity }) {
  const pathname = useHeaderPathname();
  const name = viewer.displayName ?? viewer.username ?? "Your account";

  return (
    <NavMenu
      label="Account menu"
      align="end"
      triggerClassName="group order-2 inline-flex shrink-0 items-center gap-1.5 rounded-full pl-0.5 transition-colors sm:order-3"
      triggerContent={({ open }) => (
        <>
          <span
            className={`inline-flex rounded-full p-0.5 ring-1 transition-colors ${open ? "ring-accent" : "group-hover:ring-accent-2 ring-transparent"}`}
          >
            <Avatar src={viewer.avatarUrl} name={name} size="sm" decorative />
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
      {accountLinks.map((link) => (
        <NavMenuLink
          key={link.href}
          href={link.href}
          current={link.active(pathname)}
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
  );
}
