import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { ChallengeCard } from "@/features/challenges/challenge-card";
import { listPublicChallenges } from "@/server/repositories/challenges";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Challenges" };

export default async function ChallengesPage() {
  const challenges = await listPublicChallenges();
  return (
    <main id="main-content">
      <Container className="py-12 sm:py-16">
        <p className="text-accent-2 font-mono text-xs uppercase">
          Make within the lines
        </p>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">
          OpenMIDI Challenges
        </h1>
        <p className="text-muted mt-4 max-w-2xl text-lg">
          Curated prompts with clear, machine-checkable musical boundaries.
          Browse the invitation now; entries arrive in the next challenge slice.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {challenges.map((challenge) => (
            <ChallengeCard key={challenge.id} challenge={challenge} />
          ))}
        </div>
        {!challenges.length && (
          <p className="border-subtle bg-surface rounded-card mt-10 border p-6">
            The next creative brief is still being tuned. Check back soon.
          </p>
        )}
      </Container>
    </main>
  );
}
