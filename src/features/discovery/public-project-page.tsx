import Link from "next/link";
import type { ReactNode } from "react";
import { FiArrowRight, FiDownload, FiGitBranch, FiPlus } from "react-icons/fi";
import { Container } from "@/components/layout/container";
import { Reveal } from "@/components/ui/reveal.client";
import type { PublicProjectLineage } from "@/features/discovery/types";
import { formatMusicalKey } from "@/features/projects/musical-key";
import { ArrangementMap } from "@/features/projects/arrangement-map.client";
import { countClips } from "@/features/projects/arrangement-map";
import { PublicMidiQuickPreview } from "@/features/public-midi/quick-preview-player.client";
import { projectRevisionComparisonUrl } from "@/features/midi-diff/project-revision-url";
import type { PublicProjectDetail } from "@/server/repositories/public-projects";
import type { PublicRevisionHistoryItem } from "@/server/repositories/public-midi";

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function formatDuration(durationMs: number) {
  const seconds = Math.max(0, Math.round(durationMs / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function Avatar({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`from-accent to-accent-2 text-accent-contrast grid shrink-0 place-items-center rounded-full bg-linear-to-br font-bold ${className}`}
    >
      {initials(name)}
    </span>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-subtle bg-surface-soft/55 rounded-control grid gap-0.5 border px-3.5 py-2">
      <dt className="text-muted font-mono text-[10px] tracking-[0.18em] uppercase">
        {label}
      </dt>
      <dd className="text-[15px] font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * A visitor lands here asking one question: is this worth my time, and what may
 * I do with it? So the page leads with the music — what it sounds like, how it
 * is built, and who is credited — and keeps licence, lineage, and settings in a
 * rail beside it rather than interrupting the read.
 */
export function PublicProjectPage({
  project,
  lineage,
  history,
  canCollaborate,
  ownerControls,
}: {
  project: PublicProjectDetail;
  lineage: PublicProjectLineage;
  history: PublicRevisionHistoryItem[];
  canCollaborate: boolean;
  ownerControls?: ReactNode;
}) {
  const clipCount = countClips(project.arrangementTracks);
  const silhouettes = Object.fromEntries(
    [...project.patternSilhouettes].map(([id, entry]) => [
      id,
      entry.silhouette,
    ]),
  );
  const remixable = project.license.code === "cc-by-4.0";

  return (
    <main id="main-content">
      <Container className="py-6 sm:py-10">
        <Reveal>
          <Link
            href="/library"
            prefetch={false}
            className="text-muted hover:text-accent group inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
          >
            <FiArrowRight
              aria-hidden="true"
              className="rotate-180 transition-transform group-hover:-translate-x-0.5"
            />
            The MIDI library
          </Link>
        </Reveal>

        <Reveal delay={0.04} className="mt-4">
          <header className="challenge-hero rounded-card relative overflow-hidden p-5 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-start lg:gap-8">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="border-accent/45 bg-accent/12 text-accent rounded-full border px-3 py-0.5 font-mono text-[10.5px] tracking-[0.18em] uppercase">
                    Public
                  </span>
                  <span
                    className={`rounded-full border px-3 py-0.5 font-mono text-[10.5px] tracking-[0.18em] uppercase ${
                      remixable
                        ? "border-accent-2/30 bg-accent-2/8 text-accent-2"
                        : "border-subtle text-muted"
                    }`}
                  >
                    {project.license.name}
                  </span>
                  {project.openToContributions && (
                    <span className="border-subtle text-muted rounded-full border px-3 py-0.5 font-mono text-[10.5px] tracking-[0.18em] uppercase">
                      Open to contributions
                    </span>
                  )}
                </div>

                <h1 className="mt-4 text-3xl font-bold tracking-[-0.035em] text-balance sm:text-5xl">
                  {project.title}
                </h1>

                <div className="mt-4 flex items-center gap-2.5">
                  <Avatar
                    name={project.ownerDisplayName}
                    className="size-9 text-[13px]"
                  />
                  <span className="text-sm">
                    <Link
                      prefetch={false}
                      className="hover:text-accent font-semibold transition-colors"
                      href={`/@${project.ownerUsername}`}
                    >
                      {project.ownerDisplayName}
                    </Link>
                    <span className="text-muted">
                      {" "}
                      @{project.ownerUsername}
                    </span>
                  </span>
                </div>

                {project.description && (
                  <p className="text-muted mt-5 max-w-2xl leading-relaxed whitespace-pre-wrap">
                    {project.description}
                  </p>
                )}

                <dl className="mt-6 flex flex-wrap gap-2">
                  <Fact
                    label="Tempo"
                    value={
                      project.bpm ? (
                        <>
                          {project.bpm}{" "}
                          <span className="text-muted text-xs font-medium">
                            BPM
                          </span>
                        </>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <Fact
                    label="Key"
                    value={
                      project.musicalKey
                        ? formatMusicalKey(project.musicalKey)
                        : "—"
                    }
                  />
                  <Fact
                    label="Meter"
                    value={
                      project.timeSignature
                        ? `${project.timeSignature.numerator}/${project.timeSignature.denominator}`
                        : "—"
                    }
                  />
                  <Fact
                    label="Length"
                    value={formatDuration(project.durationMs)}
                  />
                  <Fact label="Tracks" value={project.tracks.length} />
                  <Fact label="Clips" value={clipCount} />
                  <Fact label="Revision" value={project.revisionNumber} />
                </dl>
              </div>

              <PublicMidiQuickPreview
                projectId={project.projectId}
                revisionId={project.currentRevisionId}
                title={project.title}
                durationMs={project.durationMs}
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-2.5">
              {project.license.allowsDerivatives && (
                <Link
                  prefetch={false}
                  className="cta-gradient text-accent-contrast inline-flex min-h-11 items-center gap-2 rounded-full px-5 font-semibold transition-transform hover:-translate-y-px"
                  href={`/projects/${project.projectId}/fork?revision=${project.currentRevisionId}`}
                >
                  <FiGitBranch aria-hidden="true" />
                  Fork this revision
                </Link>
              )}
              {project.openToContributions && remixable && (
                <Link
                  prefetch={false}
                  className="border-strong hover:border-accent hover:text-accent inline-flex min-h-11 items-center gap-2 rounded-full border px-5 font-semibold transition-colors"
                  href={`/projects/${project.projectId}/contributions/new`}
                >
                  <FiPlus aria-hidden="true" />
                  Start a contribution
                </Link>
              )}
              {remixable && (
                <a
                  className="border-strong hover:border-accent hover:text-accent inline-flex min-h-11 items-center gap-2 rounded-full border px-5 font-semibold transition-colors"
                  href={`/api/projects/${project.projectId}/revisions/${project.currentRevisionId}/downloads/midi`}
                >
                  <FiDownload aria-hidden="true" />
                  Export MIDI + attribution
                </a>
              )}
            </div>
            {!remixable && (
              <p className="text-muted mt-4 text-sm">
                Licensed MIDI export and contributions are available for CC BY
                4.0 projects.
              </p>
            )}
            {!canCollaborate && (
              <p className="text-muted mt-3 text-sm">
                You’ll be asked to sign in before creating a fork or
                contribution.
              </p>
            )}
          </header>
        </Reveal>

        {project.arrangementTracks.length > 0 && (
          <Reveal
            as="section"
            delay={0.08}
            className="dash-card rounded-card mt-4 p-4 sm:p-6"
            aria-labelledby="arrangement-heading"
          >
            <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2
                id="arrangement-heading"
                className="text-muted font-mono text-[10.5px] tracking-[0.2em] uppercase"
              >
                Arrangement
              </h2>
              <p className="text-muted text-sm">
                {project.tracks.length}{" "}
                {project.tracks.length === 1 ? "track" : "tracks"} · {clipCount}{" "}
                {clipCount === 1 ? "clip" : "clips"}
              </p>
            </div>
            <ArrangementMap
              tracks={project.arrangementTracks}
              timeSignature={project.timeSignature}
              silhouettes={silhouettes}
            />
          </Reveal>
        )}

        {ownerControls && (
          <Reveal
            as="section"
            delay={0.08}
            className="dash-card rounded-card mt-4 p-5 sm:p-6"
            aria-labelledby="owner-settings-heading"
          >
            <p className="text-accent font-mono text-[10.5px] tracking-[0.2em] uppercase">
              Owner only
            </p>
            <h2 id="owner-settings-heading" className="mt-1 text-lg font-bold">
              Project settings
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {ownerControls}
            </div>
          </Reveal>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] lg:items-start">
          <div className="grid gap-4">
            {history.length > 0 && (
              <SemanticHistory
                projectId={project.projectId}
                history={history}
              />
            )}
          </div>

          <div className="grid gap-4">
            {project.attributions.length > 0 && (
              <Reveal
                as="section"
                delay={0.12}
                className="dash-card rounded-card p-5 sm:p-6"
                aria-labelledby="credits-heading"
              >
                <p className="text-muted font-mono text-[10.5px] tracking-[0.2em] uppercase">
                  Credits
                </p>
                <h2 id="credits-heading" className="mt-1 text-lg font-bold">
                  Who you would be crediting
                </h2>
                <ul className="mt-4 grid gap-3">
                  {project.attributions.map((attribution) => (
                    <li
                      key={`${attribution.kind}-${attribution.profileId}`}
                      className="flex items-center gap-3"
                    >
                      <Avatar
                        name={attribution.creditName}
                        className="size-8 text-[11px]"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {attribution.profileUsername ? (
                            <Link
                              prefetch={false}
                              className="hover:text-accent transition-colors"
                              href={`/@${attribution.profileUsername}`}
                            >
                              {attribution.creditName}
                            </Link>
                          ) : (
                            attribution.creditName
                          )}
                        </span>
                        <span className="text-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                          {attribution.kind === "publisher"
                            ? "Publisher"
                            : "Accepted contributor"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            )}

            <Reveal
              as="section"
              delay={0.14}
              className="dash-card rounded-card p-5 sm:p-6"
              aria-labelledby="reuse-heading"
            >
              <p className="text-muted font-mono text-[10.5px] tracking-[0.2em] uppercase">
                Reuse
              </p>
              <h2 id="reuse-heading" className="mt-1 text-lg font-bold">
                What you may do with it
              </h2>
              <dl className="mt-4 grid gap-2.5 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted font-mono text-[10px] tracking-[0.16em] uppercase">
                    Licence
                  </dt>
                  <dd className="font-semibold">
                    {project.license.url ? (
                      <a
                        className="hover:text-accent underline transition-colors"
                        href={project.license.url}
                      >
                        {project.license.name}
                      </a>
                    ) : (
                      project.license.name
                    )}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted font-mono text-[10px] tracking-[0.16em] uppercase">
                    Derivatives
                  </dt>
                  <dd className="font-semibold">
                    {project.license.allowsDerivatives
                      ? "Allowed"
                      : "Not allowed"}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted font-mono text-[10px] tracking-[0.16em] uppercase">
                    MIDI export
                  </dt>
                  <dd className="font-semibold">
                    {remixable ? "Allowed" : "Not available"}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted font-mono text-[10px] tracking-[0.16em] uppercase">
                    Contributions
                  </dt>
                  <dd className="font-semibold">
                    {project.openToContributions ? "Open" : "Closed"}
                  </dd>
                </div>
              </dl>
              <p className="text-muted mt-4 text-xs leading-relaxed">
                {project.license.summary}
              </p>
            </Reveal>

            {(project.genres.length > 0 || project.tags.length > 0) && (
              <Reveal
                as="section"
                delay={0.16}
                className="dash-card rounded-card p-5 sm:p-6"
                aria-labelledby="taxonomy-heading"
              >
                <p className="text-muted font-mono text-[10.5px] tracking-[0.2em] uppercase">
                  Filed under
                </p>
                <h2 id="taxonomy-heading" className="sr-only">
                  Genres and tags
                </h2>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {project.genres.map((genre) => (
                    <li
                      key={genre.id}
                      className="border-accent-2/30 bg-accent-2/8 text-accent-2 rounded-full border px-2.5 py-0.5 text-xs"
                    >
                      {genre.name}
                    </li>
                  ))}
                  {project.tags.map((tag) => (
                    <li
                      key={tag.id}
                      className="border-subtle text-muted rounded-full border px-2.5 py-0.5 text-xs"
                    >
                      {tag.name}
                    </li>
                  ))}
                </ul>
              </Reveal>
            )}

            {(lineage.source ||
              lineage.sourceUnavailable ||
              lineage.directForks.length > 0) && (
              <Reveal
                as="section"
                delay={0.18}
                className="dash-card rounded-card p-5 sm:p-6"
                aria-labelledby="lineage-heading"
              >
                <p className="text-muted font-mono text-[10.5px] tracking-[0.2em] uppercase">
                  Lineage
                </p>
                <h2 id="lineage-heading" className="mt-1 text-lg font-bold">
                  Forked from, forked into
                </h2>
                <div className="mt-4 grid gap-2">
                  {lineage.source ? (
                    <Link
                      prefetch={false}
                      href={`/projects/${lineage.source.projectId}`}
                      className="border-subtle bg-surface-soft/45 rounded-control hover:border-accent/45 flex items-center gap-2.5 border px-3 py-2.5 transition-colors"
                    >
                      <FiGitBranch
                        aria-hidden="true"
                        className="text-muted shrink-0"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {lineage.source.title}
                      </span>
                      <span className="text-muted shrink-0 font-mono text-[10px] tracking-[0.14em] uppercase">
                        rev {lineage.source.revisionNumber}
                      </span>
                    </Link>
                  ) : lineage.sourceUnavailable ? (
                    <p className="text-muted text-sm">Source unavailable.</p>
                  ) : null}
                  {lineage.directForks.map((fork) => (
                    <Link
                      key={fork.projectId}
                      prefetch={false}
                      href={`/projects/${fork.projectId}`}
                      className="border-subtle bg-surface-soft/45 rounded-control hover:border-accent/45 flex items-center gap-2.5 border px-3 py-2.5 transition-colors"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {fork.title}
                      </span>
                      <span className="text-muted shrink-0 font-mono text-[10px] tracking-[0.14em] uppercase">
                        fork
                      </span>
                    </Link>
                  ))}
                </div>
              </Reveal>
            )}

            {canCollaborate && (
              <Link
                className="text-muted hover:text-accent px-1 text-xs underline underline-offset-4 transition-colors"
                href={`/reports/new?kind=project&id=${project.projectId}&label=${encodeURIComponent(project.title)}`}
              >
                Report this project
              </Link>
            )}
          </div>
        </div>
      </Container>
    </main>
  );
}

export function SemanticHistory({
  projectId,
  history,
}: {
  projectId: string;
  history: PublicRevisionHistoryItem[];
}) {
  const latest = history[0];
  if (!latest) return null;
  const latestFrom = latest.parentRevisionId ?? latest.id;

  return (
    <Reveal
      as="section"
      delay={0.1}
      id="semantic-history"
      className="dash-card rounded-card scroll-mt-6 p-5 sm:p-6"
      aria-labelledby="semantic-history-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div>
          <p className="text-muted font-mono text-[10.5px] tracking-[0.2em] uppercase">
            How it got here
          </p>
          <h2 id="semantic-history-heading" className="mt-1 text-lg font-bold">
            {history.length} immutable{" "}
            {history.length === 1 ? "revision" : "revisions"}
          </h2>
        </div>
        <a
          className="border-strong hover:border-accent hover:text-accent inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors"
          href={projectRevisionComparisonUrl({
            projectId,
            from: latestFrom,
            to: latest.id,
          })}
        >
          Compare revisions
        </a>
      </div>

      <ol className="mt-5">
        {history.map((revision, index) => (
          <li
            id={`revision-${revision.revisionNumber}`}
            key={revision.id}
            className="relative scroll-mt-24 pb-7 pl-6 last:pb-0"
          >
            {index < history.length - 1 && (
              <span
                aria-hidden="true"
                className="from-accent to-accent-2/25 absolute top-4 bottom-0 left-[3.5px] w-px bg-linear-to-b"
              />
            )}
            <span
              aria-hidden="true"
              className={`absolute top-1.5 left-0 block size-[9px] rounded-full border-2 ${
                index === 0
                  ? "border-accent bg-accent shadow-[0_0_0_4px_rgb(255_141_99/0.2)]"
                  : "border-accent-2 bg-canvas"
              }`}
            />
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-accent font-mono text-[10.5px] tracking-[0.16em] uppercase">
                Revision {revision.revisionNumber}
                {index === 0 ? " · current" : ""}
              </span>
              <span className="text-muted font-mono text-[10.5px]">
                {revision.publisher.creditName}
              </span>
              <time
                className="text-muted ml-auto font-mono text-[10.5px]"
                dateTime={revision.createdAt}
              >
                {new Date(revision.createdAt).toLocaleDateString()}
              </time>
            </div>

            {revision.message && (
              <h3 className="mt-1.5 font-serif text-xl leading-snug">
                {revision.message}
              </h3>
            )}

            <ul className="mt-2 grid gap-1">
              {revision.summary.map((item) => (
                <li
                  key={item}
                  className="text-muted before:bg-accent-2/70 relative pl-4 text-sm leading-relaxed before:absolute before:top-[0.6em] before:left-0 before:size-1 before:rounded-full before:content-['']"
                >
                  {item}
                </li>
              ))}
            </ul>

            {(revision.patternLineage.length > 0 ||
              revision.acceptedContributor) && (
              <p className="text-muted mt-2 font-mono text-[10.5px]">
                {revision.patternLineage.length > 0
                  ? `${revision.patternLineage.length} MIDI ${revision.patternLineage.length === 1 ? "pattern" : "patterns"}`
                  : ""}
                {revision.patternLineage.length > 0 &&
                revision.acceptedContributor
                  ? " · "
                  : ""}
                {revision.acceptedContributor
                  ? `accepted contribution by ${revision.acceptedContributor.creditName}`
                  : ""}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <a
                className="text-muted hover:text-accent group inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
                href={projectRevisionComparisonUrl({
                  projectId,
                  from: revision.parentRevisionId ?? revision.id,
                  to: revision.id,
                })}
              >
                {revision.parentRevisionId
                  ? "Compare with its parent"
                  : "Open comparison"}
                <FiArrowRight
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </a>
              {revision.patternLineage.length > 0 && (
                <details className="w-full">
                  <summary className="text-muted hover:text-accent inline-flex cursor-pointer items-center text-xs font-semibold transition-colors">
                    Exact pattern lineage
                  </summary>
                  <ul className="border-subtle mt-2 grid gap-2.5 border-l pl-3">
                    {revision.patternLineage.map((pattern) => (
                      <li key={pattern.midiPatternVersionId}>
                        <span className="block text-xs font-semibold">
                          {pattern.creatorCreditName}
                        </span>
                        <span className="text-muted block font-mono text-[10px] break-all">
                          {pattern.midiPatternVersionId}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </li>
        ))}
      </ol>

      {history.length === 8 && (
        <p className="text-muted mt-4 text-sm">
          Showing the latest 8 bounded revisions.
        </p>
      )}
    </Reveal>
  );
}
