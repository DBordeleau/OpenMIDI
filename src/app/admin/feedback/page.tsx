import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { requireAdmin } from "@/features/auth/guards";
import { adminFeedbackFilterSchema } from "@/features/feedback/schema";
import { listAdminFeedback } from "@/server/repositories/feedback";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Beta feedback queue" };

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    kind?: string;
    after?: string;
    updated?: string;
  }>;
}) {
  const admin = await requireAdmin("/admin/feedback");
  const parsed = adminFeedbackFilterSchema.safeParse(await searchParams);
  if (!parsed.success) notFound();
  const status = parsed.data.status === "all" ? null : parsed.data.status;
  const kind = parsed.data.kind === "all" ? null : parsed.data.kind;
  let queue;
  try {
    queue = await listAdminFeedback({
      adminId: admin.id,
      status,
      kind,
      after: parsed.data.after,
    });
  } catch {
    notFound();
  }

  const nextParams = new URLSearchParams();
  if (parsed.data.status !== "all")
    nextParams.set("status", parsed.data.status);
  if (parsed.data.kind !== "all") nextParams.set("kind", parsed.data.kind);
  if (queue.nextCursor) nextParams.set("after", queue.nextCursor);

  return (
    <main id="main-content">
      <Container className="py-12 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-accent-2 font-mono text-xs uppercase">
              Private administrator tool
            </p>
            <h1 className="mt-3 text-4xl font-bold">Beta feedback queue</h1>
          </div>
          <Link
            href="/admin/moderation"
            className="border-strong rounded-full border px-5 py-3 font-semibold"
          >
            Open moderation queue
          </Link>
        </div>

        {parsed.data.updated && (
          <p
            role="status"
            className="border-accent rounded-control mt-6 border p-4"
          >
            Feedback action recorded.
          </p>
        )}

        <form
          className="border-subtle bg-surface rounded-card mt-8 flex flex-wrap items-end gap-4 border p-5"
          method="get"
        >
          <label className="grid gap-2 text-sm font-semibold">
            Status
            <select
              name="status"
              defaultValue={parsed.data.status}
              className="border-strong bg-canvas rounded-control min-h-11 border px-4"
            >
              <option value="all">All</option>
              <option value="new">New</option>
              <option value="handled">Handled</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Kind
            <select
              name="kind"
              defaultValue={parsed.data.kind}
              className="border-strong bg-canvas rounded-control min-h-11 border px-4"
            >
              <option value="all">All</option>
              <option value="bug">Bug reports</option>
              <option value="suggestion">Suggestions</option>
            </select>
          </label>
          <button className="cta-gradient text-accent-contrast min-h-11 rounded-full px-5 font-semibold">
            Filter queue
          </button>
        </form>

        <ul className="mt-8 space-y-3">
          {queue.items.map((item) => (
            <li
              key={item.id}
              className="rounded-card border-subtle bg-surface border p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/admin/feedback/${item.id}`}
                    className="text-lg font-semibold underline"
                  >
                    {item.summary}
                  </Link>
                  <p className="text-muted mt-1 text-sm">
                    <span className="capitalize">{item.kind}</span> ·{" "}
                    {item.sourcePathname} · {item.status}
                    {item.hasBrowserContext ? " · browser context" : ""}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-mono">{item.referenceId}</p>
                  <time className="text-muted" dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleString()}
                  </time>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {!queue.items.length && (
          <p className="text-muted mt-8">No feedback matches these filters.</p>
        )}
        {queue.nextCursor && (
          <Link
            className="border-strong mt-8 inline-flex min-h-11 items-center rounded-full border px-5 font-semibold"
            href={`/admin/feedback?${nextParams.toString()}`}
          >
            Next page
          </Link>
        )}
      </Container>
    </main>
  );
}
