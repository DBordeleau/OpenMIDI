import Link from "next/link";
import { Container } from "./container";
import { StatusBadge } from "../ui/status-badge";

export function SiteHeader() {
  return (
    <header className="border-subtle bg-canvas/90 sticky top-0 z-30 border-b backdrop-blur-md">
      <Container className="flex min-h-18 flex-wrap items-center justify-between gap-3 py-3">
        <Link
          href="/"
          className="text-accent font-mono text-sm font-bold tracking-[0.2em] uppercase"
        >
          Jam Session
        </Link>
        <nav
          aria-label="Primary"
          className="text-muted order-3 flex w-full items-center gap-5 text-sm sm:order-2 sm:w-auto"
        >
          <a href="#workflow" className="hover:text-ink">
            How it works
          </a>
          <a href="#mvp" className="hover:text-ink">
            MVP scope
          </a>
        </nav>
        <div className="order-2 sm:order-3">
          <StatusBadge>MVP in development</StatusBadge>
        </div>
      </Container>
    </header>
  );
}
