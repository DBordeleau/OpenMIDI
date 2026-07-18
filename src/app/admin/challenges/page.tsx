import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { requireAdmin } from "@/features/auth/guards";
import { challengePhaseMessage } from "@/features/challenges/lifecycle";
import { listAdminChallenges } from "@/server/repositories/challenges";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Challenge administration" };

export default async function AdminChallengesPage() {
  await requireAdmin("/admin/challenges");
  const challenges = await listAdminChallenges();
  return (
    <main id="main-content">
      <Container className="py-12 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-accent-2 font-mono text-xs uppercase">
              Private administrator tool
            </p>
            <h1 className="mt-3 text-4xl font-bold">Curated challenges</h1>
            <p className="text-muted mt-3 max-w-2xl">
              Create versioned creative boundaries, then publish one immutable
              version into a time-derived lifecycle.
            </p>
          </div>
          <Link
            href="/admin/challenges/new"
            className="cta-gradient text-accent-contrast min-h-11 rounded-full px-6 py-3 font-semibold"
          >
            Create challenge
          </Link>
        </div>
        <ul className="mt-8 space-y-3">
          {challenges.map((challenge) => (
            <li
              key={challenge.id}
              className="border-subtle bg-surface rounded-card border p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    className="text-xl font-bold underline"
                    href={`/admin/challenges/${challenge.id}`}
                  >
                    {challenge.title}
                  </Link>
                  <p className="text-muted mt-1">
                    /{challenge.slug} · version {challenge.versionNumber} ·
                    lifecycle {challenge.lifecycleVersion}
                  </p>
                </div>
                <span className="border-accent rounded-full border px-3 py-1 text-sm">
                  {challengePhaseMessage({
                    phase: challenge.phase,
                    votingOpensAt: challenge.votingOpensAt,
                    votingClosesAt: challenge.votingClosesAt,
                  })}
                </span>
              </div>
            </li>
          ))}
        </ul>
        {!challenges.length && (
          <p className="text-muted mt-8">No challenge identities exist yet.</p>
        )}
      </Container>
    </main>
  );
}
