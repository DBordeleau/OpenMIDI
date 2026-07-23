/**
 * The single source of truth for shared navigation.
 *
 * The desktop header and the mobile tab bar are different presentations of the
 * *same* information architecture (docs/design/brand.md §5): four top-level
 * destinations, discovery grouped under Explore, account-shaped destinations
 * grouped behind the avatar. Only the rendering forks — the link list and the
 * active-route rules live here so the two bars cannot drift apart.
 */

export type NavLink = {
  readonly href: string;
  readonly label: string;
};

export const exploreLinks: readonly NavLink[] = [
  { href: "/library", label: "MIDI Library" },
  { href: "/explore", label: "Projects" },
  { href: "/challenges", label: "Challenges" },
];

export const accountLinks: readonly NavLink[] = [
  { href: "/projects", label: "My projects" },
  { href: "/library/saved", label: "Saved clips" },
  { href: "/contributions", label: "Contributions" },
  { href: "/settings/profile", label: "Edit profile" },
];

export function accountLinksForViewer(username: string | null) {
  return username
    ? ([
        { href: `/@${username}`, label: "View profile" },
        ...accountLinks,
      ] as const)
    : accountLinks;
}

export function isDashboardCurrent(pathname: string) {
  return pathname === "/dashboard";
}

export function isExploreLinkCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isExploreCurrent(pathname: string) {
  return exploreLinks.some((link) => isExploreLinkCurrent(pathname, link.href));
}

export function isStudioCurrent(pathname: string) {
  return pathname === "/studio" || pathname.startsWith("/studio/");
}

/**
 * Account destinations need per-link rules rather than a prefix match: several
 * live under `/projects/…` alongside each other, and `/projects/new` and the
 * per-project studio must not light up "My projects".
 */
export function isAccountLinkCurrent(pathname: string, href: string) {
  switch (href) {
    case "/projects":
      return (
        pathname === "/projects" ||
        (pathname.startsWith("/projects/") &&
          pathname !== "/projects/new" &&
          !pathname.endsWith("/studio") &&
          !pathname.includes("/contributions"))
      );
    case "/contributions":
      return (
        pathname === "/contributions" ||
        (pathname.startsWith("/projects/") &&
          pathname.includes("/contributions"))
      );
    default:
      return pathname === href;
  }
}

export function isAccountCurrent(
  pathname: string,
  links: readonly NavLink[] = accountLinks,
) {
  return links.some((link) => isAccountLinkCurrent(pathname, link.href));
}
