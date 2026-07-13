import Link from "next/link";
import { Container } from "./container";
import { HeaderNav } from "./header-nav.client";

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
        <HeaderNav />
      </Container>
    </header>
  );
}
