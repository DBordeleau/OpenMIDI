import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { requireViewer } from "@/features/auth/guards";
import { ContributionList } from "@/features/contributions/contribution-list";
import { listContributionsByAuthor } from "@/server/repositories/contributions";
import { restoreContributionAction } from "@/features/moderation/actions";

export const metadata: Metadata = { title: "Contributions" };

export default async function ContributionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    after?: string;
    deleted?: string;
    restored?: string;
    restoreError?: string;
    contributionId?: string;
  }>;
}) {
  const viewer = await requireViewer("/contributions");
  const query = await searchParams;
  const status =
    query.status === "submitted" || query.status === "history"
      ? query.status
      : "active";
  const { contributions, nextCursor } = await listContributionsByAuthor(
    viewer.id,
    { status, after: query.after },
  );
  return (
    <main id="main-content">
      <Container className="py-12 sm:py-16">
        <p className="text-accent font-mono text-xs font-semibold tracking-[0.18em] uppercase">
          Private proposals
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Contributions
        </h1>
        <p className="text-muted mt-3 max-w-2xl text-lg">
          Continue private drafts, inspect immutable submissions, and track
          proposals for projects you own.
        </p>
        {query.deleted === "1" && query.contributionId && (
          <div
            role="status"
            className="border-accent rounded-control mt-6 border p-4"
          >
            Contribution deleted. It remains recoverable for 30 days.
            <form action={restoreContributionAction} className="mt-3">
              <input
                type="hidden"
                name="contributionId"
                value={query.contributionId}
              />
              <button className="text-accent font-semibold underline">
                Restore contribution
              </button>
            </form>
          </div>
        )}
        {query.restored === "1" && (
          <p
            role="status"
            className="border-accent rounded-control mt-6 border p-4"
          >
            Contribution restored.
          </p>
        )}
        {query.restoreError === "1" && (
          <p role="alert" className="text-danger mt-6">
            That contribution can no longer be restored.
          </p>
        )}
        <nav
          aria-label="Contribution filters"
          className="mt-6 flex flex-wrap gap-2"
        >
          {(
            [
              ["active", "Active"],
              ["submitted", "Submitted"],
              ["history", "History"],
            ] as const
          ).map(([value, label]) => (
            <a
              key={value}
              aria-current={status === value ? "page" : undefined}
              className={`min-h-11 rounded-full border px-4 py-2 font-semibold ${status === value ? "border-accent text-accent" : "border-strong text-muted"}`}
              href={`/contributions?status=${value}`}
            >
              {label}
            </a>
          ))}
        </nav>
        <ContributionList contributions={contributions} />
        {nextCursor && (
          <a
            className="border-strong mt-8 inline-flex min-h-11 items-center rounded-full border px-5 font-semibold"
            href={`/contributions?status=${status}&after=${encodeURIComponent(nextCursor)}`}
          >
            Next contributions
          </a>
        )}
      </Container>
    </main>
  );
}
