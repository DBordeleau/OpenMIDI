import Link from "next/link";
import { FiArrowUpRight } from "react-icons/fi";
import { PublicMidiQuickPreview } from "@/features/public-midi/quick-preview-player.client";
import type { PublicProfileProject } from "./types";

function formatProfileDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function ProfileProjectCard({
  project,
}: {
  project: PublicProfileProject;
}) {
  const headingId = `profile-project-${project.projectId}`;

  return (
    <article
      aria-labelledby={headingId}
      className="dash-card dash-card-lit dash-card-action rounded-card group relative grid w-full gap-4 overflow-hidden p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-5"
    >
      <div className="min-w-0">
        <h3
          id={headingId}
          className="text-lg font-bold tracking-[-0.02em] text-balance sm:text-xl"
        >
          <Link
            className="group-hover:text-accent transition-colors after:absolute after:inset-0 after:rounded-[inherit]"
            href={`/projects/${project.projectId}`}
          >
            {project.title}
          </Link>
        </h3>
        <p className="text-muted mt-1.5 text-sm">
          Published{" "}
          <time dateTime={project.publishedAt}>
            {formatProfileDate(project.publishedAt)}
          </time>
        </p>
      </div>

      <div className="relative z-10 flex min-w-0 flex-col gap-2 min-[23rem]:flex-row min-[23rem]:items-center">
        <PublicMidiQuickPreview
          inline
          projectId={project.projectId}
          revisionId={project.currentRevisionId}
          title={project.title}
          durationMs={project.durationMs}
        />
        <Link
          className="border-strong hover:border-accent hover:text-accent inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors"
          href={`/projects/${project.projectId}`}
        >
          Open
          <FiArrowUpRight aria-hidden="true" />
          <span className="sr-only">{project.title}</span>
        </Link>
      </div>
    </article>
  );
}
