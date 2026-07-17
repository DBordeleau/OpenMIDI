import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { requireAdmin } from "@/features/auth/guards";
import { listAdminModerationQueue } from "@/server/repositories/moderation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Moderation queue" };

export default async function AdminModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ after?: string; updated?: string }>;
}) {
  const admin = await requireAdmin("/admin/moderation");
  const query = await searchParams;
  const queue = await listAdminModerationQueue(admin.id, query.after);
  return (
    <main id="main-content">
      <Container className="py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-accent-2 font-mono text-xs uppercase">
              Administrator
            </p>
            <h1 className="mt-3 text-4xl font-bold">Moderation queue</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="border-strong rounded-full border px-5 py-3 font-semibold"
              href="/admin/feedback"
            >
              Beta feedback
            </Link>
            <Link
              className="border-strong rounded-full border px-5 py-3 font-semibold"
              href="/admin/operations"
            >
              Storage operations
            </Link>
          </div>
        </div>
        {query.updated && (
          <p
            role="status"
            className="border-accent rounded-control mt-6 border p-4"
          >
            Action recorded.
          </p>
        )}
        <ul className="mt-8 space-y-3">
          {queue.reports.map((report) => (
            <li
              className="rounded-card border-subtle bg-surface border p-5"
              key={report.id}
            >
              <Link
                className="text-lg font-semibold underline"
                href={`/admin/moderation/${report.id}`}
              >
                {report.target_label_snapshot}
              </Link>
              <p className="text-muted mt-1 text-sm capitalize">
                {report.target_kind} · {report.reason.replaceAll("_", " ")} ·{" "}
                {report.status}
              </p>
            </li>
          ))}
        </ul>
        {!queue.reports.length && (
          <p className="text-muted mt-8">The queue is clear.</p>
        )}
      </Container>
    </main>
  );
}
