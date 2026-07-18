import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { requireAdmin } from "@/features/auth/guards";
import { AdminChallengeForm } from "@/features/challenges/admin-challenge-form.client";
import { canonicalizeChallengeConstraintsV1 } from "@/features/challenges/constraint-v1";
import { listEligibleChallengeStarters } from "@/server/repositories/challenges";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Create challenge" };

export default async function NewChallengePage() {
  const admin = await requireAdmin("/admin/challenges/new");
  const starters = await listEligibleChallengeStarters();
  return (
    <main id="main-content">
      <Container className="py-12 sm:py-16">
        <p className="text-accent-2 font-mono text-xs uppercase">
          Private administrator tool
        </p>
        <h1 className="mt-3 text-4xl font-bold">Shape a new challenge</h1>
        <p className="text-muted mt-3 max-w-3xl">
          Draft the invitation, frozen UTC schedule, judging credits, optional
          exact starter, and rules generated from constraint schema v1.
        </p>
        <AdminChallengeForm
          mode="create"
          starters={starters}
          defaults={{
            slug: "",
            title: "",
            prompt: "",
            description: "",
            eligibilityTerms:
              "Entries must be original work the entrant is authorized to publish for challenge display.",
            presentationCode: "pulse",
            opensAt: "2026-08-01T12:00:00.000Z",
            submissionsCloseAt: "2026-08-08T12:00:00.000Z",
            votingOpensAt: "2026-08-09T12:00:00.000Z",
            votingClosesAt: "2026-08-11T12:00:00.000Z",
            resultsExpectedAt: "2026-08-12T12:00:00.000Z",
            judgingMode: "community",
            officialPlacementCount: 0,
            starterProjectId: null,
            starterRevisionId: null,
            constraints: canonicalizeChallengeConstraintsV1({
              schemaVersion: 1,
              trackCount: { minimum: null, maximum: null, exact: 4 },
            }),
            judges: [
              {
                role: "host",
                displayName:
                  admin.creditName ??
                  admin.displayName ??
                  "OpenMIDI administrator",
                profileId: admin.id,
              },
            ],
          }}
        />
      </Container>
    </main>
  );
}
