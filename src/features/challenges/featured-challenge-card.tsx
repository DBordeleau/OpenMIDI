import { IntentPrefetchLink } from "@/components/navigation/intent-prefetch-link.client";
import { ButtonLink } from "@/components/ui/button";
import { describeChallengeConstraintsV1 } from "./constraint-v1";
import type { FeaturedChallenge } from "./types";

function daysUntil(iso: string) {
  const days = Math.ceil(
    (new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
  return Number.isFinite(days) ? days : null;
}

export function FeaturedChallengeCard({
  featured,
}: {
  featured: FeaturedChallenge | null;
}) {
  if (!featured)
    return (
      <section
        className="dash-card rounded-card p-4 sm:p-6"
        aria-labelledby="featured-challenge-heading"
      >
        <p className="text-accent font-mono text-[11px] tracking-[0.2em] uppercase">
          Challenge desk
        </p>
        <h3
          id="featured-challenge-heading"
          className="mt-2 text-xl font-bold tracking-[-0.03em] sm:text-2xl"
        >
          The next constraint is being tuned
        </h3>
        <p className="text-muted mt-2">
          Browse completed challenges while the next curated session is
          prepared.
        </p>
        <IntentPrefetchLink
          className="text-accent mt-4 inline-block font-semibold"
          href="/challenges"
        >
          Browse challenges →
        </IntentPrefetchLink>
      </section>
    );

  const { challenge } = featured;
  // Only the first two rules — the card is a doorway, not the brief. Guarded
  // because this card sits on the dashboard: a constraint set this describer
  // cannot canonicalise should cost two chips, not the whole page.
  let rules: string[] = [];
  try {
    rules = describeChallengeConstraintsV1(challenge.constraints).slice(0, 2);
  } catch {
    rules = [];
  }
  const closesIn = daysUntil(challenge.submissionsCloseAt);
  const deadline =
    closesIn === null || closesIn < 0
      ? featured.label
      : closesIn === 0
        ? "Closes today"
        : `Closes in ${closesIn} ${closesIn === 1 ? "day" : "days"}`;

  return (
    <section
      className="dash-card rounded-card p-4 sm:p-6"
      aria-labelledby="featured-challenge-heading"
    >
      <p className="text-accent-2 font-mono text-[11px] tracking-[0.2em] uppercase">
        {deadline}
      </p>
      <h3
        id="featured-challenge-heading"
        className="mt-2 text-xl font-bold tracking-[-0.03em] sm:text-2xl"
      >
        {challenge.title}
      </h3>
      <p className="text-muted mt-2 text-sm sm:text-base">{challenge.prompt}</p>
      {/* On a phone the constraints and the action share one line; from `sm`
          up the wrapper is a plain block, so the stacked desktop rhythm (ul
          mt-4, action mt-6) is exactly what it was. */}
      <div className="mt-3 flex flex-wrap items-center gap-3 sm:mt-0 sm:block">
        {rules.length > 0 && (
          <ul className="flex flex-wrap gap-2 sm:mt-4">
            {rules.map((rule) => (
              <li
                key={rule}
                className="border-subtle text-muted rounded-full border px-2.5 py-0.5 text-xs"
              >
                {rule.replace(/\.$/, "")}
              </li>
            ))}
          </ul>
        )}
        <div className="ml-auto flex flex-wrap gap-3 sm:mt-6 sm:ml-0">
          <ButtonLink href={`/challenges/${challenge.slug}`} prefetch={false}>
            Open featured challenge
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
