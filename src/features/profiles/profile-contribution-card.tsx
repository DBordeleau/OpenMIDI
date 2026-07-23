import Link from "next/link";
import { FiArrowUpRight, FiGitPullRequest } from "react-icons/fi";
import type { AcceptedContributionHistoryItem } from "./types";

function formatProfileDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function ProfileContributionCard({
  contribution,
}: {
  contribution: AcceptedContributionHistoryItem;
}) {
  const headingId = `profile-contribution-${contribution.revisionId}`;

  return (
    <article
      aria-labelledby={headingId}
      className="dash-card dash-card-action rounded-card group relative grid w-full gap-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
    >
      <span
        aria-hidden="true"
        className="border-subtle bg-surface/70 text-berry grid size-10 shrink-0 place-items-center rounded-full border"
      >
        <FiGitPullRequest />
      </span>
      <div className="min-w-0">
        <h3
          id={headingId}
          className="text-lg font-bold tracking-[-0.02em] text-balance"
        >
          <Link
            className="group-hover:text-accent transition-colors after:absolute after:inset-0 after:rounded-[inherit]"
            href={`/projects/${contribution.projectId}`}
          >
            {contribution.projectTitle}
          </Link>
        </h3>
        <p className="text-muted mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm">
          <span className="text-ink font-semibold">
            Revision {contribution.revisionNumber}
          </span>
          <span aria-hidden="true">·</span>
          <time dateTime={contribution.acceptedAt}>
            {formatProfileDate(contribution.acceptedAt)}
          </time>
          <span aria-hidden="true">·</span>
          <span>
            Credited as{" "}
            <strong className="text-ink">{contribution.creditName}</strong>
          </span>
        </p>
      </div>
      <span className="text-accent-2 flex items-center gap-2 text-sm font-semibold sm:justify-self-end">
        Hear the result
        <FiArrowUpRight aria-hidden="true" />
      </span>
    </article>
  );
}
