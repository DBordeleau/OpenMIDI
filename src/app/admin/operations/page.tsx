import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { requireAdmin } from "@/features/auth/guards";
import { getAdminStorageSummary } from "@/server/repositories/moderation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Storage operations" };
const mib = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;

export default async function OperationsPage() {
  await requireAdmin("/admin/operations");
  const summary = await getAdminStorageSummary();
  const warning = summary.total.bytes >= summary.thresholds.warningBytes;
  return (
    <main id="main-content">
      <Container className="py-16">
        <p className="text-accent-2 font-mono text-xs uppercase">
          Administrator
        </p>
        <h1 className="mt-3 text-4xl font-bold">Storage operations</h1>
        <p className="text-muted mt-3 max-w-3xl">
          Totals come from read-only Storage object metadata. Confirm provider
          billing in the Supabase Dashboard before destructive operations.
        </p>
        <section
          className={`rounded-card mt-8 border p-6 ${warning ? "border-danger" : "border-subtle"}`}
        >
          <h2 className="text-2xl font-bold">
            {mib(summary.total.bytes)} stored
          </h2>
          <p className="text-muted mt-2">
            {summary.total.objectCount} objects ·{" "}
            {summary.total.unknownSizeCount} unknown-size ·{" "}
            {summary.untrackedObjectCount} untracked
          </p>
          <p className="mt-3 font-semibold">
            Warning {mib(summary.thresholds.warningBytes)} · stop{" "}
            {mib(summary.thresholds.stopBytes)}
          </p>
        </section>
        <section className="mt-8">
          <h2 className="text-2xl font-bold">By bucket</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="p-3">Bucket</th>
                  <th className="p-3">Objects</th>
                  <th className="p-3">Bytes</th>
                  <th className="p-3">Unknown</th>
                </tr>
              </thead>
              <tbody>
                {summary.buckets.map((bucket) => (
                  <tr className="border-subtle border-t" key={bucket.bucket}>
                    <td className="p-3 font-mono text-sm">{bucket.bucket}</td>
                    <td className="p-3">{bucket.object_count}</td>
                    <td className="p-3">{mib(bucket.bytes)}</td>
                    <td className="p-3">{bucket.unknown_size_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="rounded-card border-subtle mt-8 border p-6">
          <h2 className="text-xl font-bold">Retention</h2>
          <p className="text-muted mt-2">
            {summary.dueCleanupCount} due jobs. Preview is always read-only;
            execution is bounded and lease-bound.
          </p>
          <pre className="bg-canvas rounded-control mt-4 overflow-x-auto p-4 text-sm">
            npm run retention:preview{"\n"}npm run retention:execute
          </pre>
          {summary.lastRun && (
            <p className="text-muted mt-3 text-sm">
              Last run {summary.lastRun.status} ·{" "}
              {summary.lastRun.completedCount}/{summary.lastRun.candidateCount}{" "}
              complete
            </p>
          )}
        </section>
        <Link
          className="text-accent mt-8 inline-block underline"
          href="/admin/moderation"
        >
          Back to moderation
        </Link>
      </Container>
    </main>
  );
}
