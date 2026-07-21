import { IntentPrefetchLink } from "@/components/navigation/intent-prefetch-link.client";
import { BrandMark } from "./brand-mark";
import { Container } from "./container";
import { HeaderNav } from "./header-nav.client";

export function SiteHeader() {
  return (
    <header className="border-subtle bg-canvas/90 border-b backdrop-blur-md">
      {/* 56px on a phone, 72px from `sm` up: the mobile tab bar carries
          navigation, so the bar only needs identity and one action. */}
      <Container className="flex min-h-14 items-center gap-x-5 py-2 sm:min-h-18 sm:gap-x-6 sm:py-3">
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
