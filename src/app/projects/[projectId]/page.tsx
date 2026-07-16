import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { getOptionalViewer } from "@/features/auth/guards";
import { CollaborationSettingForm } from "@/features/contributions/collaboration-setting-form";
import { CreditList } from "@/features/credits/credit-list";
import { aggregateCredits } from "@/features/credits/types";
import {
  PublicProjectPage,
  SemanticHistory,
} from "@/features/discovery/public-project-page";
import { projectIdSchema } from "@/features/projects/schema";
import { DeleteProjectForm } from "@/features/projects/delete-project-form";
import { ProjectVisibilityForm } from "@/features/projects/project-visibility-form";
import { PublicMidiQuickPreview as QuickPreviewPlayer } from "@/features/public-midi/quick-preview-player.client";
import { listContributionsByAuthor } from "@/server/repositories/contributions";
import { getProjectLineage } from "@/server/repositories/forks";
import { getProjectForViewer } from "@/server/repositories/projects";
import {
  getPublicProject,
  getPublicProjectLineage,
} from "@/server/repositories/public-projects";
import {
  getPublicArrangementCards,
  getPublicRevisionHistory,
} from "@/server/repositories/public-midi";
import { getRevisionHistory } from "@/server/repositories/revisions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<Metadata> {
  const { projectId } = await params;
  if (!projectIdSchema.safeParse(projectId).success)
    return { robots: { index: false, follow: false } };
  const project = await getPublicProject(projectId);
  if (!project) return { robots: { index: false, follow: false } };
  return {
    title: `${project.title} · Jam Session`,
    description:
      project.description?.slice(0, 160) ??
      `A public music project by @${project.ownerUsername}.`,
    alternates: { canonical: `/projects/${project.projectId}` },
  };
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ saved?: string; forked?: string; restored?: string }>;
}) {
  const { projectId } = await params;
  if (!projectIdSchema.safeParse(projectId).success) notFound();
  const viewer = await getOptionalViewer();
  const project =
    viewer?.status === "active" && viewer.profileCompletedAt
      ? await getProjectForViewer(projectId)
      : null;
  if (!project) {
    const publicProject = await getPublicProject(projectId);
    if (!publicProject) notFound();
    const [publicLineage, history] = await Promise.all([
      getPublicProjectLineage(projectId),
      getPublicRevisionHistory(projectId),
    ]);
    return (
      <PublicProjectPage
        project={publicProject}
        lineage={publicLineage}
        history={history}
        canCollaborate={
          viewer?.status === "active" && viewer.profileCompletedAt !== null
        }
      />
    );
  }
  if (!viewer || viewer.status !== "active") notFound();
  if (project.moderationState === "hidden") {
    return (
      <main id="main-content">
        <Container className="py-16">
          <section className="rounded-card border-subtle mx-auto max-w-2xl border p-8">
            <p className="text-danger font-mono text-xs uppercase">
              Unavailable during review
            </p>
            <h1 className="mt-3 text-3xl font-bold">{project.title}</h1>
            <p className="text-muted mt-4">
              This project is hidden by moderation. Its immutable history is
              preserved, but playback, downloads, contributions, publishing, and
              workspace mutations are unavailable.
            </p>
          </section>
        </Container>
      </main>
    );
  }
  if (project.visibility === "public") {
    const publicProject = await getPublicProject(projectId);
    if (!publicProject) notFound();
    const [publicLineage, history] = await Promise.all([
      getPublicProjectLineage(projectId),
      getPublicRevisionHistory(projectId),
    ]);
    return (
      <PublicProjectPage
        project={publicProject}
        lineage={publicLineage}
        history={history}
        canCollaborate
      />
    );
  }
  const [revisions, semanticHistory, contributions, lineage, arrangementCards] =
    await Promise.all([
      getRevisionHistory(projectId),
      getPublicRevisionHistory(projectId),
      listContributionsByAuthor(viewer.id),
      getProjectLineage({
        projectId,
        sourceProjectId: project.sourceProjectId,
        sourceRevisionId: project.sourceRevisionId,
      }),
      getPublicArrangementCards(
        project.currentRevisionId
          ? [{ projectId, revisionId: project.currentRevisionId }]
          : [],
      ),
    ]);
  const liveContribution = contributions.contributions.find(
    (item) =>
      item.projectId === projectId &&
      !["withdrawn", "accepted", "rejected"].includes(item.status),
  );
  const current = revisions.find(({ id }) => id === project.currentRevisionId);
  const currentCredits = current ? aggregateCredits(current.tracks) : [];
  const currentArrangement = project.currentRevisionId
    ? arrangementCards.get(project.currentRevisionId)
    : null;
  const acceptedContributors = Array.from(
    new Map(
      revisions.flatMap((revision) =>
        revision.acceptedContributor
          ? [
              [
                revision.acceptedContributor.creditName.toLowerCase(),
                revision.acceptedContributor,
              ] as const,
            ]
          : [],
      ),
    ).values(),
  );
  const resolvedSearchParams = await searchParams;
  const saved = resolvedSearchParams.saved === "1";
  const forked = resolvedSearchParams.forked === "1";
  const restored = resolvedSearchParams.restored === "1";
  return (
    <main id="main-content">
      <Container className="py-16">
        <article className="mx-auto max-w-3xl">
          {saved && (
            <p
              role="status"
              className="rounded-control border-accent mb-6 border p-3"
            >
              Project saved.
            </p>
          )}
          {forked && (
            <p
              role="status"
              className="rounded-control border-accent mb-6 border p-3"
            >
              Private fork created. Open the studio when you are ready to make
              it your own.
            </p>
          )}
          {restored && (
            <p
              role="status"
              className="rounded-control border-accent mb-6 border p-3"
            >
              Project restored.
            </p>
          )}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-accent font-semibold">
                Private · {project.status === "active" ? "Active" : "Draft"}
              </p>
              <h1 className="mt-2 text-4xl font-bold">{project.title}</h1>
            </div>
            {project.ownerId === viewer.id && (
              <Link
                className="rounded-control border-strong min-h-11 border px-4 py-2"
                href={`/projects/${project.id}/edit`}
              >
                Edit metadata
              </Link>
            )}
          </div>
          {project.description && (
            <p className="text-muted mt-6 whitespace-pre-wrap">
              {project.description}
            </p>
          )}
          <dl className="rounded-card border-subtle bg-surface mt-8 grid gap-5 border p-6 sm:grid-cols-2">
            <div>
              <dt className="text-muted">Tempo</dt>
              <dd>{project.bpm ? `${project.bpm} BPM` : "Not set"}</dd>
            </div>
            <div>
              <dt className="text-muted">Key / signature</dt>
              <dd>
                {project.musicalKey ?? "Not set"} ·{" "}
                {project.timeSignature.numerator}/
                {project.timeSignature.denominator}
              </dd>
            </div>
            <div>
              <dt className="text-muted">License</dt>
              <dd>
                <a className="underline" href={project.license.url}>
                  {project.license.name}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-muted">Genres</dt>
              <dd>
                {project.genres
                  .map((g) => `${g.name}${g.isPrimary ? " (primary)" : ""}`)
                  .join(", ") || "None"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted">Tags</dt>
              <dd>{project.tags.map((t) => t.name).join(", ") || "None"}</dd>
            </div>
          </dl>
          {(lineage.source || lineage.sourceUnavailable) && (
            <section className="rounded-card border-subtle mt-8 border p-6">
              <h2 className="text-xl font-bold">Fork lineage</h2>
              {lineage.source ? (
                <p className="text-muted mt-2">
                  Forked from{" "}
                  <Link
                    className="underline"
                    href={`/projects/${lineage.source.projectId}`}
                  >
                    {lineage.source.title}
                  </Link>
                  , revision {lineage.source.revisionNumber}.
                </p>
              ) : (
                <p className="text-muted mt-2">Source unavailable.</p>
              )}
            </section>
          )}
          {project.status === "active" && project.ownerId === viewer.id && (
            <>
              <ProjectVisibilityForm
                projectId={project.id}
                lockVersion={project.lockVersion}
                visibility={project.visibility}
              />
              <CollaborationSettingForm
                projectId={project.id}
                lockVersion={project.lockVersion}
                open={project.openToContributions}
              />
              <Link
                className="mt-4 inline-flex underline"
                href={`/projects/${project.id}/contributions`}
              >
                View submitted contributions
              </Link>
            </>
          )}
          {project.status === "active" && project.ownerId !== viewer.id && (
            <section className="rounded-card border-subtle mt-8 border p-6">
              <h2 className="text-xl font-bold">Contribute to this project</h2>
              <p className="text-muted mt-2">
                This private project is available through your existing
                membership. Its displayed license is {project.license.name}.
              </p>
              {liveContribution ? (
                <Link
                  className="bg-accent rounded-control mt-5 inline-flex min-h-11 items-center px-5 font-semibold text-slate-950"
                  href={`/projects/${project.id}/contributions/${liveContribution.id}`}
                >
                  Continue contribution
                </Link>
              ) : project.openToContributions ? (
                <Link
                  className="bg-accent rounded-control mt-5 inline-flex min-h-11 items-center px-5 font-semibold text-slate-950"
                  href={`/projects/${project.id}/contributions/new`}
                >
                  Start contribution
                </Link>
              ) : (
                <p className="mt-4 font-semibold">Submissions are closed.</p>
              )}
            </section>
          )}
          {current ? (
            <section
              id={`revision-${current.revisionNumber}`}
              className="rounded-card border-strong mt-8 border p-6"
            >
              <p className="text-accent font-semibold">
                Current revision {current.revisionNumber}
              </p>
              <h2 className="mt-1 text-2xl font-bold">Published arrangement</h2>
              <p className="text-muted mt-2">
                Published by{" "}
                {current.publisher.profileUsername ? (
                  <Link
                    className="underline"
                    href={`/@${current.publisher.profileUsername}`}
                  >
                    {current.publisher.creditName}
                  </Link>
                ) : (
                  current.publisher.creditName
                )}{" "}
                · {new Date(current.createdAt).toLocaleString()} ·{" "}
                {(current.durationMs / 1000).toFixed(1)} seconds
              </p>
              {current.acceptedContributor && (
                <p className="text-muted mt-2">
                  Accepted contribution by{" "}
                  {current.acceptedContributor.profileUsername ? (
                    <Link
                      className="underline"
                      href={`/@${current.acceptedContributor.profileUsername}`}
                    >
                      {current.acceptedContributor.creditName}
                    </Link>
                  ) : (
                    current.acceptedContributor.creditName
                  )}
                </p>
              )}
              {current.message && (
                <p className="mt-3 whitespace-pre-wrap">{current.message}</p>
              )}
              <QuickPreviewPlayer
                projectId={project.id}
                revisionId={current.id}
                title={project.title}
                durationMs={current.durationMs}
              />
              {currentArrangement && (
                <p className="text-muted mt-4 text-sm">
                  {currentArrangement.tracks.length} MIDI{" "}
                  {currentArrangement.tracks.length === 1 ? "track" : "tracks"}{" "}
                  ·{" "}
                  {currentArrangement.tracks.reduce(
                    (total, track) => total + track.clipCount,
                    0,
                  )}{" "}
                  arrangement clips
                </p>
              )}
              <ol className="mt-5 space-y-3">
                {current.tracks.map((track) => (
                  <li
                    className="border-subtle rounded-control border p-4"
                    key={track.id}
                  >
                    <strong>
                      {track.sortOrder + 1}. {track.name}
                    </strong>
                    <span className="text-muted block text-sm">
                      {track.instrumentName ?? "No instrument"} ·{" "}
                      {(track.durationMs / 1000).toFixed(1)}s
                    </span>
                    <div className="mt-2 text-sm">
                      <CreditList credits={track.credits} />
                    </div>
                  </li>
                ))}
              </ol>
              <div className="border-subtle mt-6 border-t pt-5">
                <h3 className="font-semibold">Music credits</h3>
                <div className="mt-2 text-sm">
                  <CreditList credits={currentCredits} />
                </div>
              </div>
              <Link
                className="cta-gradient text-accent-contrast mt-6 inline-flex min-h-11 items-center rounded-full px-5 font-semibold transition-transform hover:-translate-y-px"
                href={`/studio/${project.id}`}
              >
                Open in studio
              </Link>
              {project.license.allowsDerivatives ? (
                <Link
                  className="border-strong hover:border-accent ml-3 inline-flex min-h-11 items-center rounded-full border px-5 font-semibold"
                  href={`/projects/${project.id}/fork?revision=${current.id}`}
                >
                  Fork this revision
                </Link>
              ) : (
                <p className="text-muted mt-4 text-sm">
                  This project’s license does not permit derivative forks.
                </p>
              )}
              {project.license.code === "cc-by-4.0" ? (
                <a
                  className="border-strong hover:border-accent mt-6 inline-flex min-h-11 items-center rounded-full border px-5 font-semibold"
                  href={`/api/projects/${project.id}/revisions/${current.id}/downloads/midi`}
                >
                  Export MIDI + attribution
                </a>
              ) : (
                <p className="text-muted mt-4 text-sm">
                  Licensed MIDI export is available for CC BY 4.0 projects.
                </p>
              )}
            </section>
          ) : project.ownerId === viewer.id ? (
            <section className="rounded-card border-strong mt-8 border border-dashed p-8 text-center">
              <h2 className="text-xl font-bold">
                Ready to shape the first arrangement?
              </h2>
              <p className="text-muted mt-2">
                Open the Studio, add MIDI patterns, and publish an immutable
                revision.
              </p>
              <Link
                className="bg-accent rounded-control mt-5 inline-flex min-h-11 items-center px-5 font-semibold text-slate-950"
                href={`/projects/${project.id}/publish`}
              >
                Publish first revision
              </Link>
            </section>
          ) : null}
          {revisions.length > 1 && (
            <section className="mt-8">
              <h2 className="text-xl font-bold">Revision history</h2>
              <ol className="mt-3 space-y-2">
                {revisions.map((revision) => (
                  <li key={revision.id}>
                    <a
                      className="underline"
                      href={`#revision-${revision.revisionNumber}`}
                    >
                      Revision {revision.revisionNumber}
                    </a>{" "}
                    · {new Date(revision.createdAt).toLocaleDateString()}
                  </li>
                ))}
              </ol>
            </section>
          )}
          {semanticHistory.length > 0 && (
            <SemanticHistory history={semanticHistory} />
          )}
          {acceptedContributors.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xl font-bold">Accepted contributors</h2>
              <ul className="mt-3 space-y-1">
                {acceptedContributors.map((contributor) => (
                  <li key={contributor.creditName}>
                    {contributor.profileUsername ? (
                      <Link
                        className="underline"
                        href={`/@${contributor.profileUsername}`}
                      >
                        {contributor.creditName}
                      </Link>
                    ) : (
                      contributor.creditName
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {project.ownerId === viewer.id && (
            <DeleteProjectForm
              projectId={project.id}
              projectTitle={project.title}
              lockVersion={project.lockVersion}
            />
          )}
          {project.ownerId !== viewer.id && (
            <Link
              className="text-muted hover:text-accent mt-8 inline-block text-sm underline"
              href={`/reports/new?kind=project&id=${project.id}&label=${encodeURIComponent(project.title)}`}
            >
              Report this project
            </Link>
          )}
          {lineage.directForks.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xl font-bold">Direct forks</h2>
              <ul className="mt-3 space-y-2">
                {lineage.directForks.map((fork) => (
                  <li key={fork.projectId}>
                    <Link
                      className="underline"
                      href={`/projects/${fork.projectId}`}
                    >
                      {fork.title}
                    </Link>{" "}
                    <span className="text-muted">
                      · {new Date(fork.createdAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
              {lineage.hasMoreDirectForks && (
                <p className="text-muted mt-3 text-sm">
                  Showing the 20 most recent forks you can access.
                </p>
              )}
            </section>
          )}
        </article>
      </Container>
    </main>
  );
}
