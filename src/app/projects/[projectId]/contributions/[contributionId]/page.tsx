import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { requireViewer } from "@/features/auth/guards";
import { contributionIdSchema } from "@/features/contributions/schema";
import { ReviewComparison } from "@/features/contributions/review-comparison";
import { ReviewContributionForm } from "@/features/contributions/review-contribution-form.client";
import { SubmissionPanel } from "@/features/contributions/submission-panel.client";
import { WithdrawContributionForm } from "@/features/contributions/withdraw-contribution-form";
import { ContributionDeletionForm } from "@/features/moderation/contribution-deletion-form";
import { projectIdSchema } from "@/features/projects/schema";
import type {
  ContributionArrangementComparison,
  ContributionReviewStudio,
} from "@/features/contributions/types";
import {
  getContributionArrangementComparison,
  getContributionForViewer,
} from "@/server/repositories/contributions";
import { getStudioWorkspaceV3 } from "@/server/repositories/studio-v3";

const labels = {
  draft: "Draft",
  submitted: "Submitted",
  changes_requested: "Changes requested",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
} as const;

export default async function ContributionDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; contributionId: string }>;
}) {
  const { projectId, contributionId } = await params;
  if (
    !projectIdSchema.safeParse(projectId).success ||
    !contributionIdSchema.safeParse(contributionId).success
  )
    notFound();
  const viewer = await requireViewer(
    "/projects/" + projectId + "/contributions/" + contributionId,
  );
  const contribution = await getContributionForViewer(contributionId);
  if (!contribution || contribution.projectId !== projectId) notFound();
  if (contribution.moderationState === "hidden") {
    return (
      <main id="main-content">
        <Container className="py-16">
          <section className="rounded-card border-subtle mx-auto max-w-2xl border p-8">
            <p className="text-danger font-mono text-xs uppercase">
              Unavailable during review
            </p>
            <h1 className="mt-3 text-3xl font-bold">{contribution.title}</h1>
            <p className="text-muted mt-4">
              This contribution is hidden by moderation. Immutable submitted
              history remains preserved, but playback, review, and mutation are
              unavailable.
            </p>
          </section>
        </Container>
      </main>
    );
  }
  const isAuthor = contribution.authorId === viewer.id;
  const isOwner = contribution.projectOwnerId === viewer.id;
  const editable =
    contribution.status === "draft" ||
    contribution.status === "changes_requested";
  const workspace = isAuthor ? await getStudioWorkspaceV3(projectId) : null;
  const linkedWorkspace =
    workspace?.contributionId === contribution.id ? workspace : null;
  const durationMs = linkedWorkspace
    ? arrangementDurationMs(linkedWorkspace.manifest)
    : 0;
  const currentVersion = contribution.versions.find(
    (version) => version.id === contribution.currentVersionId,
  );
  let comparison: ContributionArrangementComparison | null = null;
  let comparisonLoadFailed = false;
  if (isOwner && currentVersion) {
    try {
      comparison = await getContributionArrangementComparison({
        projectId,
        contributionId,
        versionId: currentVersion.id,
      });
    } catch {
      comparisonLoadFailed = true;
    }
  }
  const stale =
    contribution.currentProjectRevisionId !== contribution.baseRevisionId;
  return (
    <main id="main-content">
      <Container className="py-12">
        <article className="mx-auto max-w-3xl">
          <Link
            className="text-accent underline"
            href={"/projects/" + projectId + "/contributions"}
          >
            Return to project contributions
          </Link>
          <p className="text-accent mt-6 font-semibold">
            {labels[contribution.status]} Â· Based on exact revision
          </p>
          <h1 className="mt-2 text-4xl font-bold">{contribution.title}</h1>
          <p className="text-muted mt-2">{contribution.projectTitle}</p>
          {contribution.description && (
            <p className="mt-6 whitespace-pre-wrap">
              {contribution.description}
            </p>
          )}
          <dl className="rounded-card border-subtle mt-8 grid gap-4 border p-6 sm:grid-cols-2">
            <div>
              <dt className="text-muted">Base revision</dt>
              <dd>Revision {contribution.baseRevisionNumber}</dd>
            </div>
            <div>
              <dt className="text-muted">Current project revision</dt>
              <dd>
                {contribution.currentProjectRevisionNumber
                  ? `Revision ${contribution.currentProjectRevisionNumber}`
                  : "Unavailable"}
                {stale ? " · Base is outdated" : " · Base is current"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Project license</dt>
              <dd>
                <a className="underline" href={contribution.license.url}>
                  {contribution.license.name}
                </a>
              </dd>
            </div>
          </dl>
          {isOwner &&
            currentVersion &&
            (comparison ? (
              <ReviewComparison comparison={comparison} />
            ) : (
              <ReviewComparison
                comparison={null}
                unavailableReason={
                  comparisonLoadFailed ? "inconsistent" : "unavailable"
                }
              />
            ))}
          {isAuthor && linkedWorkspace && editable && (
            <Link
              className="bg-accent rounded-control mt-6 inline-flex min-h-11 items-center px-5 font-semibold text-slate-950"
              href={`/studio/${projectId}`}
            >
              Open in studio
            </Link>
          )}
          <section className="mt-10">
            <h2 className="text-2xl font-bold">Immutable version history</h2>
            {contribution.versions.length === 0 ? (
              <p className="text-muted mt-3">No versions submitted yet.</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {contribution.versions.map((version) => (
                  <li
                    className="rounded-control border-subtle border p-4"
                    key={version.id}
                  >
                    <strong>Version {version.versionNumber}</strong>
                    <span className="text-muted block text-sm">
                      {new Date(version.createdAt).toLocaleString()} Â·{" "}
                      {version.trackCount} tracks Â·{" "}
                      {(version.durationMs / 1000).toFixed(1)} seconds
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          {contribution.reviews.length > 0 && (
            <section className="mt-10">
              <h2 className="text-2xl font-bold">Review history</h2>
              <ol className="mt-4 space-y-3">
                {contribution.reviews.map((review) => (
                  <li
                    className="rounded-control border-subtle border p-4"
                    key={review.id}
                  >
                    <strong>
                      {review.reason === "base_outdated"
                        ? "Changes requested · Base outdated"
                        : review.appliedDecision === "request_changes"
                          ? "Changes requested"
                          : review.appliedDecision === "reject"
                            ? "Rejected"
                            : "Accepted"}
                    </strong>
                    <span className="text-muted block text-sm">
                      {new Date(review.createdAt).toLocaleString()}
                    </span>
                    {review.note && (
                      <p className="mt-2 whitespace-pre-wrap">{review.note}</p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}
          {contribution.acceptedRevisionId && (
            <p className="mt-8">
              Accepted as{" "}
              <Link
                className="text-accent underline"
                href={`/projects/${projectId}#revision-${contribution.acceptedRevisionNumber}`}
              >
                revision {contribution.acceptedRevisionNumber}
              </Link>
              .
            </p>
          )}
          {isOwner &&
            contribution.status === "submitted" &&
            currentVersion &&
            contribution.currentProjectRevisionId && (
              <ReviewContributionForm
                projectId={projectId}
                contributionId={contribution.id}
                contributionTitle={contribution.title}
                currentVersionId={currentVersion.id}
                currentVersionNumber={currentVersion.versionNumber}
                currentProjectRevisionId={contribution.currentProjectRevisionId}
                stale={stale}
              />
            )}
          {isAuthor && linkedWorkspace && editable && (
            <SubmissionPanel
              projectId={projectId}
              contributionId={contribution.id}
              baseRevisionId={contribution.baseRevisionId}
              workspace={{
                lockVersion: linkedWorkspace.lockVersion,
                manifestSha256: linkedWorkspace.manifestSha256,
                updatedAt: linkedWorkspace.updatedAt,
                trackCount: linkedWorkspace.manifest.tracks.length,
                durationMs,
                hasAcknowledgedSave: linkedWorkspace.lockVersion > 1,
              }}
              license={contribution.license}
            />
          )}
          {isAuthor &&
            ["draft", "submitted", "changes_requested"].includes(
              contribution.status,
            ) && (
              <WithdrawContributionForm
                projectId={projectId}
                contributionId={contribution.id}
                status={contribution.status}
                currentVersionId={contribution.currentVersionId}
              />
            )}
          {isOwner && (
            <Link
              className="text-muted hover:text-accent mt-6 inline-block text-sm underline"
              href={`/reports/new?kind=contribution&id=${contribution.id}&label=${encodeURIComponent(contribution.title)}`}
            >
              Report this contribution
            </Link>
          )}
          {isAuthor &&
            ["rejected", "withdrawn"].includes(contribution.status) && (
              <ContributionDeletionForm contributionId={contribution.id} />
            )}
        </article>
      </Container>
    </main>
  );
}

function arrangementDurationMs(studio: ContributionReviewStudio["manifest"]) {
  return Math.ceil(
    (studio.durationTicks * 60_000) / (studio.tempoBpm * studio.ppq),
  );
}
