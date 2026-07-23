import Link from "next/link";
import { FiArrowUpRight } from "react-icons/fi";
import { formatMusicalKeyShort } from "@/features/projects/musical-key";
import { PublicMidiQuickPreview } from "@/features/public-midi/quick-preview-player.client";
import type { PublicProject } from "./types";

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

function MetricChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-subtle text-muted inline-flex min-h-7 shrink-0 items-center rounded-full border px-2.5 font-mono text-[10.5px] tracking-wide uppercase">
      {children}
    </span>
  );
}

export function DiscoveryProjectCard({ project }: { project: PublicProject }) {
  const primaryGenre = project.genres.find((genre) => genre.isPrimary);

  return (
    <article className="dash-card dash-card-lit dash-card-action rounded-card group relative flex w-full flex-col overflow-hidden p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-accent font-mono text-[10.5px] tracking-[0.16em] uppercase">
          {primaryGenre?.name ?? project.genres[0]?.name ?? "MIDI project"}
        </span>
        {project.openToContributions && (
          <span className="border-accent-2/35 bg-accent-2/10 text-accent-2 ml-auto rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-widest uppercase">
            Open session
          </span>
        )}
      </div>

      <h3 className="mt-3 text-xl font-bold tracking-[-0.02em] text-balance sm:text-2xl">
        <Link
          className="group-hover:text-accent transition-colors after:absolute after:inset-0 after:rounded-[inherit]"
          href={`/projects/${project.projectId}`}
        >
          {project.title}
        </Link>
      </h3>

      <div className="mt-2.5 flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="from-accent to-accent-2 text-accent-contrast grid size-8 shrink-0 place-items-center rounded-full bg-linear-to-br text-[11px] font-bold"
        >
          {initials(project.ownerDisplayName)}
        </span>
        <p className="min-w-0 text-sm">
          <span className="block truncate font-semibold">
            {project.ownerDisplayName}
          </span>
          <Link
            className="text-muted hover:text-accent relative z-10 block truncate transition-colors"
            href={`/@${project.ownerUsername}`}
          >
            @{project.ownerUsername}
          </Link>
        </p>
      </div>

      {project.description && (
        <p className="text-muted mt-3 line-clamp-2 text-sm leading-relaxed">
          {project.description}
        </p>
      )}

      <div className="relative z-10">
        <PublicMidiQuickPreview
          compact
          projectId={project.projectId}
          revisionId={project.currentRevisionId}
          title={project.title}
          durationMs={project.durationMs}
        />
      </div>

      <div className="mt-3 flex [scrollbar-width:none] gap-1.5 overflow-x-auto pb-1">
        <MetricChip>
          {project.bpm ? `${project.bpm} BPM` : "Free tempo"}
        </MetricChip>
        <MetricChip>
          {project.musicalKey
            ? formatMusicalKeyShort(project.musicalKey)
            : "No key"}
        </MetricChip>
        <MetricChip>
          {project.tracks.length} track
          {project.tracks.length === 1 ? "" : "s"}
        </MetricChip>
        <MetricChip>Rev {project.revisionNumber}</MetricChip>
      </div>

      <div className="mt-auto pt-4">
        <Link
          className="border-strong hover:border-accent hover:text-accent relative z-10 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border px-5 font-semibold transition-colors"
          href={`/projects/${project.projectId}`}
        >
          Open project
          <FiArrowUpRight aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
