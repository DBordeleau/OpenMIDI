import Link from "next/link";
import { AuthAwareLink } from "@/features/auth/auth-aware-link.client";
import { Container } from "./container";

export function SiteFooter() {
  return (
    <footer className="border-subtle border-t py-8">
      <Container className="text-muted flex flex-col gap-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="text-ink font-semibold">Jam Session</span> —
          asynchronous music collaboration with history.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link className="hover:text-ink" href="/">
            Home
          </Link>
          <Link className="hover:text-ink" href="/projects">
            My projects
          </Link>
          <Link className="hover:text-ink" href="/projects/new">
            New project
          </Link>
          <Link className="hover:text-ink" href="/contributions">
            Contributions
          </Link>
          <AuthAwareLink
            signedOut={{ href: "/sign-in", label: "Sign in" }}
            signedIn={{ href: "/settings/profile", label: "Account" }}
            className="hover:text-ink"
          />
        </nav>
      </Container>
    </footer>
  );
}
