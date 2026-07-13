"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  {
    href: "/projects",
    label: "My projects",
    active: (pathname: string) =>
      pathname === "/projects" ||
      (pathname.startsWith("/projects/") &&
        pathname !== "/projects/new" &&
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
  {
    href: "/uploads",
    label: "Uploads",
    active: (pathname: string) => pathname === "/uploads",
  },
] as const;

export function PrimaryNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="border-subtle bg-surface-soft order-3 flex w-full items-center gap-1 overflow-x-auto rounded-full border p-1 text-sm sm:order-2 sm:w-auto"
    >
      {links.map((link) => {
        const current = link.active(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current ? "page" : undefined}
            className={`rounded-full px-3 py-2 font-medium whitespace-nowrap transition-colors ${
              current
                ? "bg-surface-raised text-ink shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
