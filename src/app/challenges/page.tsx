import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { Reveal } from "@/components/ui/reveal.client";
import { ChallengeCard } from "@/features/challenges/challenge-card";
import type { ChallengePhase } from "@/features/challenges/lifecycle";
import type { Challenge } from "@/features/challenges/types";
import { listPublicChallenges } from "@/server/repositories/challenges";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Challenges" };

/** What a visitor can act on first, then what they can plan for, then history. */
const PHASE_RANK: Record<ChallengePhase, number> = {
  open: 0,
  voting: 1,
  scheduled: 2,
  completed: 3,
  cancelled: 4,
  draft: 5,
};

function byRelevance(left: Challenge, right: Challenge) {
  const rank = PHASE_RANK[left.phase] - PHASE_RANK[right.phase];
  if (rank !== 0) return rank;
  // Within a phase, whatever moves next comes first.
  return new Date(left.opensAt).getTime() - new Date(right.opensAt).getTime();
}

export default async function ChallengesPage() {
  const challenges = [...(await listPublicChallenges())].sort(byRelevance);
  const openCount = challenges.filter(
    (challenge) => challenge.phase === "open",
  ).length;

  return (
    <main id="main-content">
      <Container className="py-6 sm:py-10">
        <Reveal as="header">
          <p className="text-accent-2 font-mono text-[11px] tracking-[0.2em] uppercase">
            Make within the lines
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-balance sm:text-3xl">
            Curated prompts.{" "}
            <em className="text-accent font-serif font-medium">
              Real boundaries.
            </em>
          </h1>
          <p className="text-muted mt-3 max-w-2xl leading-relaxed">
            {openCount > 0 && (
              <span className="text-ink font-semibold">
                {openCount}{" "}
                {openCount === 1
                  ? "challenge is taking entries"
                  : "challenges are taking entries"}{" "}
                right now.{" "}
              </span>
            )}
            Every brief states its limits up front — tempo, key, track count —
            so you know what you are writing to before you start.
          </p>
        </Reveal>

        {challenges.length ? (
          <ul className="mt-7 grid gap-4 md:grid-cols-2">
            {challenges.map((challenge, index) => (
              <Reveal
                as="li"
                key={challenge.id}
                delay={Math.min(index, 5) * 0.04}
                className="flex"
              >
                <ChallengeCard challenge={challenge} />
              </Reveal>
            ))}
          </ul>
        ) : (
          <p className="border-strong rounded-card text-muted mt-7 border border-dashed p-8 text-center">
            The next creative brief is still being tuned. Check back soon.
          </p>
        )}
      </Container>
    </main>
  );
}
