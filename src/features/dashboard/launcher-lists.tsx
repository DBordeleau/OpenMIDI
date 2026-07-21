import { FiArrowRight } from "react-icons/fi";
import { IntentPrefetchLink } from "@/components/navigation/intent-prefetch-link.client";
import { MIDI_V3_PPQ } from "@/features/midi/domain-v3";
import type { DashboardData } from "./types";

/**
 * Rows past this index are hidden below `sm`. On a phone the fourth and fifth
 * row are never on screen alongside anything else, so hiding them lets a thumb
 * reach the next *section* instead of the next row — and "View all" is right
 * there in the header. Desktop still shows the full five.
 */
const MOBILE_ROWS = 3;

/**
 * A quiet navigation link whose arrow slides independently on hover. Used for
 * every "go somewhere" affordance that is not a button, so they all behave the
 * same way.
 */
export function ArrowLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <IntentPrefetchLink
      href={href}
      className="text-muted hover:text-accent group inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
    >
      {children}
      <FiArrowRight
        aria-hidden="true"
        className="transition-transform group-hover:translate-x-0.5"
      />
    </IntentPrefetchLink>
  );
}

/**
 * Section headers carry the same horizontal gutter as the cards beneath them,
 * so "New project" lands on the same vertical line as every "Open in studio"
 * in the list and the heading aligns with the row titles.
 */
export function SectionHeader({
  id,
  title,
  count,
  viewAll,
  children,
}: {
  id: string;
  title: string;
  count?: number;
  viewAll?: { href: string; label: string };
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-5">
      <h2 id={id} className="text-xl font-bold tracking-[-0.02em]">
        {title}
      </h2>
      {count !== undefined && (
        <span className="border-subtle text-muted rounded-full border px-2 py-0.5 font-mono text-[11px]">
          {count}
        </span>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-4">
        {viewAll && <ArrowLink href={viewAll.href}>{viewAll.label}</ArrowLink>}
        {children}
      </div>
    </div>
  );
}

function StatusChip({
  tone,
  children,
}: {
  tone: "active" | "draft" | "review" | "changes";
  children: React.ReactNode;
}) {
  const tones = {
    active: "text-accent border-accent/45 bg-accent/10",
    draft: "text-muted border-subtle",
    review: "text-accent-2 border-accent-2/50 bg-accent-2/10",
    changes: "text-danger border-danger/45 bg-danger/10",
  } as const;
  return (
    <span
      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] uppercase ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  children,
  href,
  action,
}: {
  children: React.ReactNode;
  href: string;
  action: string;
}) {
  return (
    <div className="border-strong rounded-card border border-dashed p-6 text-center">
      <p className="text-muted">{children}</p>
      <IntentPrefetchLink
        className="text-accent mt-3 inline-block font-semibold"
        href={href}
      >
        {action} →
      </IntentPrefetchLink>
    </div>
  );
}

/**
 * The row itself opens the project; the one explicit button goes to the Studio.
 * That split is what keeps a list of four projects at four buttons instead of
 * eight. `row-stretch` is the stretched-link pattern — the accessible name
 * stays the visible title.
 */
export function ProjectRows({
  projects,
  mobileRows = MOBILE_ROWS,
}: {
  projects: DashboardData["ownedProjects"];
  mobileRows?: number;
}) {
  if (!projects.length)
    return (
      <EmptyState href="/projects/new" action="Create a project">
        Start a project and publish your first revision.
      </EmptyState>
    );

  return (
    <ul className="grid gap-2.5">
      {projects.map((project, index) => (
        <li
          key={project.projectId}
          className={`dash-card dash-card-action rounded-card group relative flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-4 ${index >= mobileRows ? "hidden sm:flex" : ""}`}
        >
          <div className="min-w-0 flex-1">
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <IntentPrefetchLink
                href={`/projects/${project.projectId}`}
                // Truncated only on a phone, where the row is one line. From
                // `sm` up a long title wraps exactly as it did before.
                className="group-hover:text-accent truncate text-[17px] font-semibold tracking-[-0.02em] transition-colors after:absolute after:inset-0 after:rounded-[inherit] sm:overflow-visible sm:whitespace-normal"
              >
                {project.title}
              </IntentPrefetchLink>
              {project.reviewCount > 0 ? (
                <StatusChip tone="review">
                  {project.reviewCount} to review
                </StatusChip>
              ) : (
                <StatusChip
                  tone={project.status === "active" ? "active" : "draft"}
                >
                  {project.status}
                </StatusChip>
              )}
            </span>
            <p className="text-muted mt-1.5 font-mono text-[11px]">
              {project.revisionNumber
                ? `rev ${project.revisionNumber}`
                : "no revision yet"}
              {" · "}
              {project.trackCount}{" "}
              {project.trackCount === 1 ? "track" : "tracks"}
              {" · "}
              updated{" "}
              <time dateTime={project.updatedAt}>
                {new Date(project.updatedAt).toLocaleDateString()}
              </time>
            </p>
          </div>
          {/* The accessible name stays "Open in studio" at every width, and it
              contains the shortened visible label, so WCAG 2.5.3 holds. */}
          <IntentPrefetchLink
            href={`/studio/${project.projectId}`}
            aria-label="Open in studio"
            className="border-strong hover:border-accent hover:text-accent relative z-10 inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition-colors"
          >
            <span className="sm:hidden">Studio</span>
            <span className="hidden sm:inline">Open in studio</span>
          </IntentPrefetchLink>
        </li>
      ))}
    </ul>
  );
}

/**
 * Clips show length and note count, not a rendered piano roll — the dashboard
 * payload carries neither note data nor a time signature for a clip, and a
 * drawn-from-nothing roll would be a lie. The bar is real: clip length relative
 * to the longest clip in the list.
 */
export function ClipRows({
  clips,
  mobileRows = MOBILE_ROWS,
}: {
  clips: DashboardData["recentClips"];
  mobileRows?: number;
}) {
  if (!clips.length)
    return (
      <EmptyState href="/studio" action="Open the studio">
        Clips you write appear here, one press from the editor.
      </EmptyState>
    );

  const longest = Math.max(...clips.map((clip) => clip.durationTicks), 1);

  return (
    <ul className="grid gap-2.5">
      {clips.map((clip, index) => {
        const beats = Math.max(Math.round(clip.durationTicks / MIDI_V3_PPQ), 1);
        const fill = `${(clip.durationTicks / longest) * 100}%`;
        return (
          <li
            key={clip.patternVersionId}
            className={`dash-card dash-card-action rounded-card group relative grid gap-2 px-4 py-3 sm:gap-3 sm:px-5 sm:py-4 ${index >= mobileRows ? "hidden sm:grid" : ""}`}
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <b className="text-[15px] font-semibold tracking-[-0.015em]">
                {clip.patternName}
              </b>
              <span className="text-accent-2 font-mono text-[11px]">
                v{clip.versionNumber}
              </span>
              {/* A phone gets the measurements here so the chips row can go;
                  a wider screen has room for the project instead. Only one is
                  ever displayed, so only one reaches assistive technology. */}
              <span className="text-muted ml-auto truncate font-mono text-[11px] sm:hidden">
                {beats} beats · {clip.noteCount} notes
              </span>
              <span className="text-muted ml-auto hidden truncate font-mono text-[11px] sm:inline">
                {clip.projectTitle}
              </span>
            </div>
            <div
              aria-hidden="true"
              className="bg-surface-soft/80 border-subtle hidden h-1.5 overflow-hidden rounded-full border sm:block"
            >
              <div
                className="from-accent-2 to-accent h-full rounded-full bg-linear-to-r"
                style={{ width: fill }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                aria-hidden="true"
                className="bg-surface-soft/80 border-subtle h-1.5 flex-1 overflow-hidden rounded-full border sm:hidden"
              >
                <span
                  className="from-accent-2 to-accent block h-full rounded-full bg-linear-to-r"
                  style={{ width: fill }}
                />
              </span>
              <span className="border-subtle text-muted hidden rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] tracking-widest uppercase sm:inline">
                {beats} beats
              </span>
              <span className="border-subtle text-muted hidden rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] tracking-widest uppercase sm:inline">
                {clip.noteCount} notes
              </span>
              <IntentPrefetchLink
                href={`/studio/${clip.projectId}?editClip=${clip.clipId}`}
                aria-label="Open in editor"
                className="border-strong hover:border-accent hover:text-accent relative z-10 ml-auto inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold transition-colors"
              >
                <span className="sm:hidden">Editor</span>
                <span className="hidden sm:inline">Open in editor</span>
              </IntentPrefetchLink>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ContributionRows({
  contributions,
}: {
  contributions: DashboardData["pendingContributions"];
}) {
  if (!contributions.length)
    return (
      <EmptyState href="/explore" action="Explore open projects">
        Your drafts and submitted proposals will appear here.
      </EmptyState>
    );

  const tone = {
    submitted: "review",
    changes_requested: "changes",
    draft: "draft",
  } as const;

  return (
    <ul className="grid gap-2.5 sm:grid-cols-2">
      {contributions.map((contribution) => (
        <li
          key={contribution.contributionId}
          className="dash-card dash-card-action rounded-card group relative grid content-start gap-2 px-5 py-4"
        >
          <span className="flex flex-wrap items-center gap-2">
            <IntentPrefetchLink
              href={`/projects/${contribution.projectId}/contributions/${contribution.contributionId}`}
              className="group-hover:text-accent font-semibold tracking-[-0.02em] transition-colors after:absolute after:inset-0 after:rounded-[inherit]"
            >
              {contribution.title}
            </IntentPrefetchLink>
            <StatusChip tone={tone[contribution.status]}>
              {contribution.status.replaceAll("_", " ")}
            </StatusChip>
          </span>
          <p className="text-muted font-mono text-[11px]">
            to {contribution.projectTitle}
            {contribution.currentVersionNumber
              ? ` · v${contribution.currentVersionNumber}`
              : " · not submitted"}
          </p>
        </li>
      ))}
    </ul>
  );
}
