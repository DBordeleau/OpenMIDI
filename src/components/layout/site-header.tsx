import Link from "next/link";
import { AuthAwareLink } from "@/features/auth/auth-aware-link.client";
import { Container } from "./container";

const primaryLinks = [
  { href: "/projects/new", label: "New project" },
  { href: "/uploads", label: "Uploads" },
] as const;

export function SiteHeader() {
  return (
    <header className="border-subtle bg-canvas/90 sticky top-0 z-30 border-b backdrop-blur-md">
      <Container className="flex min-h-18 flex-wrap items-center gap-x-6 gap-y-3 py-3">
        <Link
          href="/"
          className="text-accent mr-auto font-mono text-sm font-bold tracking-[0.2em] uppercase"
        >
          Jam Session
        </Link>
        <nav
          aria-label="Primary"
          className="text-muted order-3 flex w-full items-center gap-x-5 gap-y-2 overflow-x-auto pb-1 text-sm sm:order-2 sm:w-auto sm:overflow-visible sm:pb-0"
        >
          {primaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-ink shrink-0 py-2 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <AuthAwareLink
          signedOut={{ href: "/sign-in", label: "Sign in" }}
          signedIn={{ href: "/settings/profile", label: "Account" }}
          className="rounded-control bg-accent hover:bg-accent-strong order-2 inline-flex min-h-11 shrink-0 items-center px-4 text-sm font-semibold text-slate-950 transition-colors sm:order-3"
        />
      </Container>
    </header>
  );
}
