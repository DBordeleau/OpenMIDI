import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/layout/container";
import type {
  PublicProject,
  PublicProjectLineage,
} from "@/features/discovery/types";
import { resolveSynthPreset } from "@/features/midi/presets";
import { formatMusicalKey } from "@/features/projects/musical-key";
import { PublicMidiQuickPreview } from "@/features/public-midi/quick-preview-player.client";
import type { PublicRevisionHistoryItem } from "@/server/repositories/public-midi";

export function PublicProjectPage({
  project,
  lineage,
  history,
  canCollaborate,
  ownerControls,
}: {
  project: PublicProject;
  lineage: PublicProjectLineage;
  history: PublicRevisionHistoryItem[];
  canCollaborate: boolean;
  ownerControls?: ReactNode;
}) {
  return (
    <main id="main-content">
      <Container className="py-12 sm:py-16">
        <article className="mx-auto max-w-3xl">
          <p className="text-accent font-semibold">Public MIDI project</p>
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
              <dt className="text-muted">Key / meter</dt>
              <dd>
                {project.musicalKey
                  ? formatMusicalKey(project.musicalKey)
                  : "Not set"}{" "}
                ·{" "}
                {project.timeSignature
                  ? `${project.timeSignature.numerator}/${project.timeSignature.denominator}`
                  : "Not set"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Reuse license</dt>
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
            <PublicMidiQuickPreview
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
                    {
                      resolveSynthPreset(track.preset.id, track.preset.version)
                        .name
                    }{" "}
                    preset · {track.clipCount}{" "}
                    {track.clipCount === 1 ? "clip" : "clips"}
                  </span>
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
              {project.openToContributions &&
                project.license.code === "cc-by-4.0" && (
                  <Link
                    className="cta-gradient text-accent-contrast rounded-full px-5 py-3 font-semibold"
                    href={`/projects/${project.projectId}/contributions/new`}
                  >
                    Start contribution
                  </Link>
                )}
              {project.license.code === "cc-by-4.0" && (
                <a
                  className="border-strong hover:border-accent inline-flex min-h-11 items-center rounded-full border px-5 font-semibold"
                  href={`/api/projects/${project.projectId}/revisions/${project.currentRevisionId}/downloads/midi`}
                >
                  Export MIDI + attribution
                </a>
              )}
            </div>
            {project.license.code !== "cc-by-4.0" && (
              <p className="text-muted mt-4 text-sm">
                Licensed MIDI export and contributions are available for CC BY
                4.0 projects.
              </p>
            )}
            {!canCollaborate && (
              <p className="text-muted mt-4 text-sm">
                You’ll be asked to sign in before creating a fork or
                contribution.
              </p>
            )}
          </section>

          {ownerControls}

          {history.length > 0 && <SemanticHistory history={history} />}

          {project.attributions.length > 0 && (
            <section className="rounded-card border-subtle mt-8 border p-6">
              <h2 className="text-xl font-bold">Arrangement attribution</h2>
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
              <h2 className="text-xl font-bold">Project lineage</h2>
              {lineage.source ? (
                <p className="text-muted mt-2">
                  Forked from{" "}
                  <Link
                    className="underline"
                    href={`/projects/${lineage.source.projectId}`}
                  >
                    {lineage.source.title}
                  </Link>
                  , exact revision {lineage.source.revisionNumber}.
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
          {canCollaborate && (
            <Link
              className="text-muted hover:text-accent mt-8 inline-block text-sm underline"
              href={`/reports/new?kind=project&id=${project.projectId}&label=${encodeURIComponent(project.title)}`}
            >
              Report this project
            </Link>
          )}
        </article>
      </Container>
    </main>
  );
}

export function SemanticHistory({
  history,
}: {
  history: PublicRevisionHistoryItem[];
}) {
  return (
    <section className="rounded-card border-subtle mt-8 border p-6">
      <p className="text-accent font-mono text-[11px] tracking-[0.18em] uppercase">
        Semantic history
      </p>
      <h2 className="mt-1 text-2xl font-bold">How this arrangement evolved</h2>
      <ol className="mt-5 space-y-5">
        {history.map((revision) => (
          <li
            id={`revision-${revision.revisionNumber}`}
            className="border-subtle border-l pl-5"
            key={revision.id}
          >
            <p className="text-accent font-mono text-xs tracking-wider uppercase">
              Revision {revision.revisionNumber} ·{" "}
              {revision.publisher.creditName}
            </p>
            {revision.message && (
              <h3 className="mt-2 font-serif text-xl">{revision.message}</h3>
            )}
            <ul className="text-ink/90 mt-2 space-y-1">
              {revision.summary.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-muted mt-2 text-sm">
              {new Date(revision.createdAt).toLocaleDateString()} ·{" "}
              {revision.patternLineage.length} MIDI{" "}
              {revision.patternLineage.length === 1 ? "pattern" : "patterns"}
              {revision.acceptedContributor
                ? ` · accepted contribution by ${revision.acceptedContributor.creditName}`
                : ""}
            </p>
            <details className="border-subtle rounded-control mt-3 border p-3 text-sm">
              <summary className="font-semibold">Exact pattern lineage</summary>
              <ul className="text-muted mt-3 space-y-3">
                {revision.patternLineage.map((pattern) => (
                  <li key={pattern.midiPatternVersionId}>
                    <span className="text-ink block">
                      {pattern.creatorCreditName}
                    </span>
                    <span className="block font-mono text-xs break-all">
                      Pattern version {pattern.midiPatternVersionId}
                    </span>
                    {(pattern.parentMidiPatternVersionId ||
                      pattern.sourceMidiPatternVersionId) && (
                      <span className="block font-mono text-xs break-all">
                        {pattern.parentMidiPatternVersionId
                          ? `Parent ${pattern.parentMidiPatternVersionId}`
                          : `Source ${pattern.sourceMidiPatternVersionId}`}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ol>
      {history.length === 8 && (
        <p className="text-muted mt-4 text-sm">
          Showing the latest 8 bounded revisions.
        </p>
      )}
    </section>
  );
}
