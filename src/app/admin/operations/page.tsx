import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { requireAdmin } from "@/features/auth/guards";
import { getAdminRetentionSummary } from "@/server/repositories/moderation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Retention operations" };

export default async function OperationsPage() {
  await requireAdmin("/admin/operations");
  const summary = await getAdminRetentionSummary();
  return (
    <main id="main-content">
      <Container className="py-16">
        <p className="text-accent-2 font-mono text-xs uppercase">
          Administrator
        </p>
        <h1 className="mt-3 text-4xl font-bold">Retention operations</h1>
        <p className="text-muted mt-3 max-w-3xl">
          Review due account-deletion and moderation-metadata cleanup before a
          bounded retention run. Generated avatars do not create stored files.
        </p>
        <section className="rounded-card border-subtle mt-8 border p-6">
          <h2 className="text-2xl font-bold">Retention queue</h2>
          <p className="text-muted mt-2">
            {summary.dueCleanupCount} due cleanup candidates. Preview remains
            read-only; execution is bounded and lease-bound.
          </p>
        </section>
        <section className="rounded-card border-subtle mt-8 border p-6">
          <h2 className="text-xl font-bold">Run controls</h2>
          <p className="text-muted mt-2">
            Always inspect the preview before execution. These commands retain
            their existing authorization and hold checks.
          </p>
          <pre className="bg-canvas rounded-control mt-4 overflow-x-auto p-4 text-sm">
            npm run retention:preview{"\n"}npm run retention:execute
          </pre>
          {summary.lastRun && (
            <p className="text-muted mt-3 text-sm">
              Last run {summary.lastRun.status} /{" "}
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
