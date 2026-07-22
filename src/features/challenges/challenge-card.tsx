import Link from "next/link";
import { formatRemaining, nextChallengeMilestone } from "./challenge-countdown";
import { describeChallengeConstraintsV1 } from "./constraint-v1";
import { challengePhaseMessage } from "./lifecycle";
import type { Challenge } from "./types";

const RULE_PREVIEW_COUNT = 3;

function shortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * The invitation, not the archive record. A visitor scanning this grid asks
 * three things — what is it, may I still enter, and what are the limits — so the
 * card answers in that order and leaves the frozen dates to the detail page.
 */
export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const label = challengePhaseMessage({
    phase: challenge.phase,
    votingOpensAt: challenge.votingOpensAt,
    votingClosesAt: challenge.votingClosesAt,
  });
  const milestone = nextChallengeMilestone(challenge);
  const remaining = milestone ? formatRemaining(milestone.at) : null;

  let rules: string[] = [];
  try {
    rules = describeChallengeConstraintsV1(challenge.constraints);
  } catch {
    rules = [];
  }
  const host = challenge.judges.find((judge) => judge.role === "host");

  return (
    <article className="dash-card dash-card-action rounded-card group relative flex w-full flex-col p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="border-accent/45 bg-accent/12 text-accent rounded-full border px-3 py-0.5 font-mono text-[10.5px] tracking-[0.18em] uppercase">
          {label}
        </span>
        {milestone && remaining && (
          <span
            className={`ml-auto rounded-full border px-3 py-0.5 text-xs ${
              milestone.urgent
                ? "border-accent/35 bg-accent/10 text-accent"
                : "border-accent-2/30 bg-accent-2/8 text-accent-2"
            }`}
          >
            {milestone.label}{" "}
            <span className="font-semibold">
              {remaining.value} {remaining.unit}
            </span>
          </span>
        )}
      </div>

      <h2 className="mt-4 text-2xl font-bold tracking-[-0.03em] text-balance">
        <Link
          prefetch={false}
          href={`/challenges/${challenge.slug}`}
          className="group-hover:text-accent transition-colors after:absolute after:inset-0 after:rounded-[inherit]"
        >
          {challenge.title}
        </Link>
      </h2>
      <p className="text-accent-2 mt-2 font-semibold text-balance">
        {challenge.prompt}
      </p>
      <p className="text-muted mt-2 line-clamp-2 text-sm leading-relaxed">
        {challenge.description}
      </p>

      {rules.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {rules.slice(0, RULE_PREVIEW_COUNT).map((rule) => (
            <li
              key={rule}
              className="border-accent-2/30 bg-accent-2/8 text-accent-2 rounded-full border px-2.5 py-0.5 text-xs"
            >
              {rule.replace(/\.$/, "")}
            </li>
          ))}
          {rules.length > RULE_PREVIEW_COUNT && (
            <li className="text-accent-2/70 px-1 py-0.5 text-xs">
              +{rules.length - RULE_PREVIEW_COUNT} more
            </li>
          )}
        </ul>
      )}

      <div className="border-subtle text-muted mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-4 font-mono text-[10.5px] tracking-[0.14em] uppercase">
        {host && (
          <span>
            Hosted by <span className="text-ink">{host.creditName}</span>
          </span>
        )}
        <time className="text-accent-2/85 ml-auto" dateTime={challenge.opensAt}>
          {shortDate(challenge.opensAt)} –{" "}
          {shortDate(challenge.resultsExpectedAt)}
        </time>
      </div>
    </article>
  );
}
