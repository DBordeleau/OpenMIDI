import Link from "next/link";
import { AuthAwareLink } from "@/features/auth/auth-aware-link.client";
import { Container } from "./container";

export function SiteFooter() {
  return (
    <footer className="border-subtle border-t py-8">
      <Container className="text-muted flex flex-col gap-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="text-ink font-semibold">Jam Session</span> — make
          music with the right people.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link className="hover:text-ink" href="/">
            Home
          </Link>
          <Link className="hover:text-ink" href="/explore">
            Explore
          </Link>
          <Link className="hover:text-ink" href="/challenges">
            Challenges
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
          <Link className="hover:text-ink" href="/community-rules">
            Community rules
          </Link>
          <Link className="hover:text-ink" href="/reports">
            Reports
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
