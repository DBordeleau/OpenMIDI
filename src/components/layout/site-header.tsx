import { IntentPrefetchLink } from "@/components/navigation/intent-prefetch-link.client";
import { BrandMark } from "./brand-mark";
import { Container } from "./container";
import { HeaderNav } from "./header-nav.client";

export function SiteHeader() {
  return (
    <header className="border-subtle bg-canvas/90 border-b backdrop-blur-md">
      <Container className="flex min-h-18 flex-wrap items-center gap-x-5 gap-y-3 py-3 sm:gap-x-6">
        <IntentPrefetchLink
          href="/"
          className="text-ink hover:text-accent mr-auto inline-flex shrink-0 items-center gap-2.5 text-[17px] font-bold tracking-[-0.03em] transition-colors"
        >
          <BrandMark gradientId="site-header-mark" />
          <span>
            Open<span className="text-muted font-medium">MIDI</span>
          </span>
        </IntentPrefetchLink>
        <HeaderNav />
      </Container>
    </header>
  );
}
