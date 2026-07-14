import Link from "next/link";
import { Container } from "@/components/layout/container";
import type {
  PublicProject,
  PublicProjectLineage,
} from "@/features/discovery/types";
import { QuickPreviewPlayer } from "@/features/studio/waveform-playlist-adapter/quick-preview-player.client";

export function PublicProjectPage({
  project,
  lineage,
  canCollaborate,
}: {
  project: PublicProject;
  lineage: PublicProjectLineage;
  canCollaborate: boolean;
}) {
  return (
    <main id="main-content">
      <Container className="py-12 sm:py-16">
        <article className="mx-auto max-w-3xl">
          <p className="text-accent font-semibold">Public project</p>
          <h1 className="mt-2 text-4xl font-bold">{project.title}</h1>
          <p className="text-muted mt-3">
            by{" "}
            <Link className="underline" href={`/@${project.ownerUsername}`}>
              {project.ownerDisplayName}
            </Link>
          </p>
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
                {project.timeSignature
                  ? `${project.timeSignature.numerator}/${project.timeSignature.denominator}`
                  : "Not set"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">License</dt>
              <dd>
                {project.license.url ? (
                  <a className="underline" href={project.license.url}>
                    {project.license.name}
                  </a>
                ) : (
                  project.license.name
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Genres</dt>
              <dd>
                {project.genres.map((genre) => genre.name).join(", ") || "None"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted">Tags</dt>
              <dd>
                {project.tags.map((tag) => tag.name).join(", ") || "None"}
              </dd>
            </div>
          </dl>
          <section className="rounded-card border-strong mt-8 border p-6">
            <p className="text-accent font-semibold">
              Current revision {project.revisionNumber}
            </p>
            <h2 className="mt-1 text-2xl font-bold">Published arrangement</h2>
            <p className="text-muted mt-2">
              {project.tracks.length}{" "}
              {project.tracks.length === 1 ? "track" : "tracks"} ·{" "}
              {(project.durationMs / 1000).toFixed(1)} seconds
            </p>
            <QuickPreviewPlayer
              projectId={project.projectId}
              revisionId={project.currentRevisionId}
              title={project.title}
              durationMs={project.durationMs}
            />
            <ol className="mt-5 space-y-3">
              {project.tracks.map((track) => (
                <li
                  className="border-subtle rounded-control border p-4"
                  key={track.id}
                >
                  <strong>
                    {track.sortOrder + 1}. {track.name}
                  </strong>
                  <span className="text-muted block text-sm">
                    {track.instrument?.name ?? "No instrument"} ·{" "}
                    {(track.durationMs / 1000).toFixed(1)}s
                  </span>
                  {track.credits.length > 0 && (
                    <ul className="mt-2 text-sm">
                      {track.credits.map((credit) => (
                        <li key={`${track.id}-${credit.position}`}>
                          {credit.profileUsername ? (
                            <Link
                              className="underline"
                              href={`/@${credit.profileUsername}`}
                            >
                              {credit.creditName}
                            </Link>
                          ) : (
                            credit.creditName
                          )}{" "}
                          · {credit.role}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-wrap gap-3">
              {project.license.allowsDerivatives && (
                <Link
                  className="border-strong rounded-full border px-5 py-3 font-semibold"
                  href={`/projects/${project.projectId}/fork?revision=${project.currentRevisionId}`}
                >
                  Fork this revision
                </Link>
              )}
              {project.openToContributions && (
                <Link
                  className="bg-accent rounded-full px-5 py-3 font-semibold text-slate-950"
                  href={`/projects/${project.projectId}/contributions/new`}
                >
                  Start contribution
                </Link>
              )}
            </div>
            {!canCollaborate && (
              <p className="text-muted mt-4 text-sm">
                You’ll be asked to sign in before creating a fork or
                contribution.
              </p>
            )}
          </section>
          {project.attributions.length > 0 && (
            <section className="rounded-card border-subtle mt-8 border p-6">
              <h2 className="text-xl font-bold">Project credits</h2>
              <ul className="mt-3 space-y-2">
                {project.attributions.map((attribution) => (
                  <li key={`${attribution.kind}-${attribution.profileId}`}>
                    {attribution.profileUsername ? (
                      <Link
                        className="underline"
                        href={`/@${attribution.profileUsername}`}
                      >
                        {attribution.creditName}
                      </Link>
                    ) : (
                      attribution.creditName
                    )}
                    <span className="text-muted">
                      {" "}
                      ·{" "}
                      {attribution.kind === "publisher"
                        ? "publisher"
                        : "accepted contributor"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {(lineage.source ||
            lineage.sourceUnavailable ||
            lineage.directForks.length > 0) && (
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
              ) : lineage.sourceUnavailable ? (
                <p className="text-muted mt-2">Source unavailable.</p>
              ) : null}
              {lineage.directForks.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {lineage.directForks.map((fork) => (
                    <li key={fork.projectId}>
                      <Link
                        className="underline"
                        href={`/projects/${fork.projectId}`}
                      >
                        {fork.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </article>
      </Container>
    </main>
  );
}
