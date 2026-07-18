"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  {
    href: "/dashboard",
    label: "Dashboard",
    active: (pathname: string) => pathname === "/dashboard",
  },
  {
    href: "/explore",
    label: "Explore",
    active: (pathname: string) => pathname === "/explore",
  },
  {
    href: "/library",
    label: "MIDI library",
    active: (pathname: string) => pathname.startsWith("/library"),
  },
  {
    href: "/challenges",
    label: "Challenges",
    active: (pathname: string) => pathname.startsWith("/challenges"),
  },
  {
    href: "/studio",
    label: "Studio",
    active: (pathname: string) =>
      pathname === "/studio" || pathname.startsWith("/studio/"),
  },
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
    href: "/projects/new",
    label: "New project",
    active: (pathname: string) => pathname === "/projects/new",
  },
  {
    href: "/contributions",
    label: "Contributions",
    active: (pathname: string) =>
      pathname === "/contributions" ||
      (pathname.startsWith("/projects/") &&
        pathname.includes("/contributions")),
  },
] as const;

export function PrimaryNavigation() {
  const pathname = usePathname();

  const items = links.map((link) => {
    const current = link.active(pathname);
    return (
      <Link
        key={link.href}
        href={link.href}
        aria-current={current ? "page" : undefined}
        className={`rounded-full px-3 py-2 font-medium whitespace-nowrap transition-colors ${current ? "bg-surface-raised text-ink shadow-sm" : "text-muted hover:text-accent"}`}
      >
        {link.label}
      </Link>
    );
  });
  return (
    <>
      <details className="border-subtle bg-surface-soft order-3 w-full rounded-3xl border p-2 sm:hidden">
        <summary className="min-h-11 cursor-pointer rounded-full px-4 py-3 font-semibold">
          Menu
        </summary>
        <nav aria-label="Primary mobile" className="mt-2 grid gap-1">
          {items}
          <Link
            href="/settings/profile"
            className="text-muted rounded-full px-3 py-2 font-medium"
          >
            Account
          </Link>
        </nav>
      </details>
      <nav
        aria-label="Primary"
        className="border-subtle bg-surface-soft order-3 hidden items-center gap-1 rounded-full border p-1 text-sm sm:order-2 sm:flex"
      >
        {items}
      </nav>
    </>
  );
}
