import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { requireAdmin } from "@/features/auth/guards";
import { AdminChallengeForm } from "@/features/challenges/admin-challenge-form.client";
import { AdminChallengeLifecycle } from "@/features/challenges/admin-challenge-lifecycle.client";
import { ChallengeRules } from "@/features/challenges/challenge-rules";
import {
  challengePhaseMessage,
  isChallengePubliclyAddressable,
} from "@/features/challenges/lifecycle";
import {
  getAdminChallenge,
  listEligibleChallengeStarters,
} from "@/server/repositories/challenges";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin challenge detail" };

export default async function AdminChallengeDetailPage({
  params,
}: {
  params: Promise<{ challengeId: string }>;
}) {
  const { challengeId } = await params;
  await requireAdmin(`/admin/challenges/${challengeId}`);
  const [challenge, starters] = await Promise.all([
    getAdminChallenge(challengeId),
    listEligibleChallengeStarters(),
  ]);
  if (!challenge) notFound();
  const starterOptions =
    challenge.starter &&
    !starters.some(
      (starter) => starter.revisionId === challenge.starter?.revisionId,
    )
      ? [
          {
            projectId: challenge.starter.projectId,
            revisionId: challenge.starter.revisionId,
            title: `${challenge.starter.projectTitle} (snapshot)`,
            revisionNumber: challenge.starter.revisionNumber,
          },
          ...starters,
        ]
      : starters;
  return (
    <main id="main-content">
      <Container className="py-12 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-accent-2 font-mono text-xs uppercase">
              Private administrator tool
            </p>
            <h1 className="mt-3 text-4xl font-bold">{challenge.title}</h1>
            <p className="text-muted mt-2">
              /{challenge.slug} · immutable version {challenge.versionNumber} ·{" "}
              {challengePhaseMessage({
                phase: challenge.phase,
                votingOpensAt: challenge.votingOpensAt,
                votingClosesAt: challenge.votingClosesAt,
              })}
            </p>
          </div>
          {isChallengePubliclyAddressable(challenge) && (
            <Link
              className="border-strong min-h-11 rounded-full border px-5 py-3 font-semibold"
              href={`/challenges/${challenge.slug}`}
            >
              Open public page
            </Link>
          )}
          <Link
            className="border-strong min-h-11 rounded-full border px-5 py-3 font-semibold"
            href={`/admin/challenges/${challenge.id}/results`}
          >
            Voting, moderation, and results
          </Link>
        </div>
        <div className="mt-8">
          <ChallengeRules constraints={challenge.constraints} />
        </div>
        <AdminChallengeLifecycle challenge={challenge} />
        {challenge.state === "draft" ? (
          <AdminChallengeForm
            mode="revise"
            challengeId={challenge.id}
            expectedLifecycleVersion={challenge.lifecycleVersion}
            expectedCurrentVersionId={challenge.currentVersionId}
            starters={starterOptions}
            defaults={{
              slug: challenge.slug,
              title: challenge.title,
              prompt: challenge.prompt,
              description: challenge.description,
              eligibilityTerms: challenge.eligibilityTerms,
              presentationCode: challenge.presentationCode,
              opensAt: challenge.opensAt,
              submissionsCloseAt: challenge.submissionsCloseAt,
              votingOpensAt: challenge.votingOpensAt,
              votingClosesAt: challenge.votingClosesAt,
              resultsExpectedAt: challenge.resultsExpectedAt,
              judgingMode: challenge.judgingMode,
              officialPlacementCount: challenge.officialPlacementCount,
              starterProjectId: challenge.starter?.projectId ?? null,
              starterRevisionId: challenge.starter?.revisionId ?? null,
              constraints: challenge.constraints,
              judges: challenge.judges.map((judge) => ({
                role: judge.role,
                displayName: judge.displayName,
                profileId: judge.profileId,
              })),
            }}
          />
        ) : (
          <p className="border-subtle bg-surface rounded-card mt-8 border p-5">
            Published and cancelled challenges cannot be revised. Their exact
            version remains frozen.
          </p>
        )}
      </Container>
    </main>
  );
}
