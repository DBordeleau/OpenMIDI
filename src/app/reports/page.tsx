import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { requireViewer } from "@/features/auth/guards";
import { listViewerReports } from "@/server/repositories/moderation";

export const metadata: Metadata = { title: "Your reports" };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ after?: string; submitted?: string }>;
}) {
  const viewer = await requireViewer("/reports");
  const query = await searchParams;
  let page;
  let cursorInvalid = false;
  try {
    page = await listViewerReports(viewer.id, query.after);
  } catch (error) {
    if (error instanceof Error && error.message === "reports_cursor_invalid") {
      cursorInvalid = true;
      page = await listViewerReports(viewer.id);
    } else throw error;
  }
  return (
    <main id="main-content">
      <Container className="py-16">
        <section className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold">Your reports</h1>
          <p className="text-muted mt-3">
            This view shows only the target, submission time, and a coarse
            review status. Private details and moderator actions stay private.
          </p>
          {(query.submitted || cursorInvalid) && (
            <p
              role="status"
              className="border-accent rounded-control mt-6 border p-4"
            >
              {query.submitted
                ? "Report submitted. The target remains visible unless an administrator takes action."
                : "That page link expired. Showing your newest reports."}
            </p>
          )}
          {page.reports.length ? (
            <ul className="mt-8 space-y-3">
              {page.reports.map((report) => (
                <li
                  className="rounded-card border-subtle bg-surface border p-5"
                  key={report.id}
                >
                  <p className="font-semibold">{report.target_label}</p>
                  <p className="text-muted mt-1 text-sm capitalize">
                    {report.target_kind} · {report.status} ·{" "}
                    <time dateTime={report.created_at}>
                      {new Date(report.created_at).toLocaleString()}
                    </time>
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-card border-subtle text-muted mt-8 border border-dashed p-6">
              You haven’t submitted any reports.
            </p>
          )}
          {page.nextCursor && (
            <Link
              className="border-strong mt-6 inline-flex min-h-11 items-center rounded-full border px-5 font-semibold"
              href={`/reports?after=${encodeURIComponent(page.nextCursor)}`}
            >
              Next reports
            </Link>
          )}
        </section>
      </Container>
    </main>
  );
}
