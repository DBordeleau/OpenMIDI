import Link from "next/link";
import type { ContributionListItem } from "./types";

const labels = {
  draft: "Draft",
  submitted: "Submitted",
  changes_requested: "Changes requested",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
} as const;

export function ContributionList({
  contributions,
}: {
  contributions: ContributionListItem[];
}) {
  if (contributions.length === 0)
    return (
      <section className="rounded-card border-strong mt-8 border border-dashed p-8 text-center">
        <h2 className="text-xl font-bold">No contributions yet</h2>
        <p className="text-muted mt-2">
          Contributions you author or submitted proposals you own will appear
          here.
        </p>
      </section>
    );
  return (
    <ul className="mt-8 grid gap-4 lg:grid-cols-2">
      {contributions.map((contribution) => (
        <li
          className="rounded-card border-subtle bg-surface border p-6"
          key={contribution.id}
        >
          <p className="text-accent text-sm font-semibold">
            {labels[contribution.status]}
            {contribution.currentVersionNumber
              ? " Â· Version " + contribution.currentVersionNumber
              : ""}
          </p>
          <h2 className="mt-2 text-2xl font-bold">
            <Link
              className="hover:text-accent"
              href={
                "/projects/" +
                contribution.projectId +
                "/contributions/" +
                contribution.id
              }
            >
              {contribution.title}
            </Link>
          </h2>
          <p className="text-muted mt-2">{contribution.projectTitle}</p>
          <p className="text-muted mt-5 text-sm">
            Updated {new Date(contribution.updatedAt).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
