import Link from "next/link";
import { challengePhaseMessage } from "./lifecycle";
import type { Challenge } from "./types";

export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const label = challengePhaseMessage({
    phase: challenge.phase,
    votingOpensAt: challenge.votingOpensAt,
    votingClosesAt: challenge.votingClosesAt,
  });
  return (
    <article className="border-subtle bg-surface rounded-card border p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="border-accent text-accent rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase">
          {label}
        </span>
        <time className="text-muted text-sm" dateTime={challenge.opensAt}>
          Opens {new Date(challenge.opensAt).toLocaleString()}
        </time>
      </div>
      <h2 className="mt-5 text-2xl font-bold">
        <Link
          href={`/challenges/${challenge.slug}`}
          className="underline decoration-2 underline-offset-4"
        >
          {challenge.title}
        </Link>
      </h2>
      <p className="text-accent-2 mt-2 font-semibold">{challenge.prompt}</p>
      <p className="text-muted mt-3 line-clamp-3">{challenge.description}</p>
    </article>
  );
}
