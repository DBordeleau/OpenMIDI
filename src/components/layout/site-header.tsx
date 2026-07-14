import Link from "next/link";
import { Container } from "./container";
import { HeaderNav } from "./header-nav.client";

export function SiteHeader() {
  return (
    <header className="border-subtle bg-canvas/90 sticky top-0 z-30 border-b backdrop-blur-md">
      <Container className="flex min-h-18 flex-wrap items-center gap-x-3 gap-y-3 py-3 sm:gap-x-6">
        <Link
          href="/"
          className="text-ink hover:text-accent mr-auto inline-flex shrink-0 items-center gap-2 text-base font-bold tracking-[-0.02em] transition-colors sm:gap-2.5 sm:text-[17px]"
        >
          <span
            aria-hidden="true"
            className="h-[11px] w-[11px] rounded-full"
            style={{
              background:
                "linear-gradient(140deg,var(--color-accent),var(--color-accent-2))",
              boxShadow: "0 0 16px rgb(255 175 120 / 0.6)",
            }}
          />
          Jam Session
        </Link>
        <HeaderNav />
      </Container>
    </header>
  );
}
