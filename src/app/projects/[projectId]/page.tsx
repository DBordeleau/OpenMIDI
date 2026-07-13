import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { StemDownloadPanel } from "@/features/exports/stem-download-panel.client";
import { requireViewer } from "@/features/auth/guards";
import { CollaborationSettingForm } from "@/features/contributions/collaboration-setting-form";
import { projectIdSchema } from "@/features/projects/schema";
import { listContributionsByAuthor } from "@/server/repositories/contributions";
import { getProjectForViewer } from "@/server/repositories/projects";
import { getRevisionHistory } from "@/server/repositories/revisions";
export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { projectId } = await params;
  const viewer = await requireViewer(`/projects/${projectId}`);
  if (!projectIdSchema.safeParse(projectId).success) notFound();
  const project = await getProjectForViewer(projectId);
  if (!project) notFound();
  const revisions = await getRevisionHistory(projectId);
  const contributions = await listContributionsByAuthor();
  const liveContribution = contributions.find(
    (item) =>
      item.projectId === projectId &&
      !["withdrawn", "accepted", "rejected"].includes(item.status),
  );
  const current = revisions.find(({ id }) => id === project.currentRevisionId);
  const saved = (await searchParams).saved === "1";
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
          {project.status === "active" && project.ownerId === viewer.id && (
            <>
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
                By {current.authorName} ·{" "}
                {new Date(current.createdAt).toLocaleString()} ·{" "}
                {(current.durationMs / 1000).toFixed(1)} seconds
              </p>
              {current.message && (
                <p className="mt-3 whitespace-pre-wrap">{current.message}</p>
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
                      {(track.durationMs / 1000).toFixed(1)}s · Creator:{" "}
                      {track.creditName}
                    </span>
                  </li>
                ))}
              </ol>
              <Link
                className="bg-accent rounded-control mt-6 inline-flex min-h-11 items-center px-5 font-semibold text-slate-950"
                href={`/projects/${project.id}/studio`}
              >
                Open studio
              </Link>
              <div className="mt-6">
                <StemDownloadPanel
                  endpoint={`/api/projects/${project.id}/revisions/${current.id}/downloads/stems`}
                  assetIds={current.tracks.map((track) => track.assetId)}
                />
              </div>
            </section>
          ) : project.ownerId === viewer.id ? (
            <section className="rounded-card border-strong mt-8 border border-dashed p-8 text-center">
              <h2 className="text-xl font-bold">Ready to assemble stems?</h2>
              <p className="text-muted mt-2">
                Create the first immutable revision from your verified uploads.
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
        </article>
      </Container>
    </main>
  );
}
