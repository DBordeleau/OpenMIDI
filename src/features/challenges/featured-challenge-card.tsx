import { IntentPrefetchLink } from "@/components/navigation/intent-prefetch-link.client";
import type { FeaturedChallenge } from "./types";

export function FeaturedChallengeCard({
  featured,
}: {
  featured: FeaturedChallenge | null;
}) {
  return (
    <section
      className="border-accent bg-surface-raised rounded-card mt-8 border p-6 shadow-[0_24px_70px_-45px_#000] sm:p-7"
      aria-labelledby="featured-challenge-heading"
    >
      <p className="text-accent font-mono text-xs tracking-widest uppercase">
        {featured?.label ?? "Challenge desk"}
      </p>
      <h2
        id="featured-challenge-heading"
        className="mt-2 text-2xl font-semibold"
      >
        {featured?.challenge.title ?? "The next constraint is being tuned"}
      </h2>
      <p className="text-muted mt-2 max-w-2xl">
        {featured?.challenge.prompt ??
          "Browse completed challenges while the next curated session is prepared."}
      </p>
      <IntentPrefetchLink
        className="text-accent mt-4 inline-block font-semibold"
        href={
          featured ? `/challenges/${featured.challenge.slug}` : "/challenges"
        }
      >
        {featured ? "Open featured challenge" : "Browse challenges"} →
      </IntentPrefetchLink>
    </section>
  );
}
