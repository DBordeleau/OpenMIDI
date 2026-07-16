import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { requireAdmin } from "@/features/auth/guards";
import { AdminActionForm } from "@/features/moderation/admin-action-form";
import { HoldForm } from "@/features/moderation/hold-form";
import { getAdminModerationTarget } from "@/server/repositories/moderation";
import { z } from "zod";

export const dynamic = "force-dynamic";

export default async function AdminReportPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  await requireAdmin("/admin/moderation");
  const reportId = z.uuid().safeParse((await params).reportId);
  if (!reportId.success) notFound();
  const report = await getAdminModerationTarget(reportId.data);
  if (!report) notFound();
  return (
    <main id="main-content">
      <Container className="py-16">
        <article className="mx-auto max-w-2xl">
          <p className="text-accent-2 font-mono text-xs uppercase">
            Private administrator detail
          </p>
          <h1 className="mt-3 text-3xl font-bold">{report.targetLabel}</h1>
          <dl className="rounded-card border-subtle bg-surface mt-6 grid gap-4 border p-6 sm:grid-cols-2">
            <div>
              <dt className="text-muted">Target</dt>
              <dd className="capitalize">{report.targetKind}</dd>
            </div>
            <div>
              <dt className="text-muted">Status</dt>
              <dd className="capitalize">{report.status}</dd>
            </div>
            <div>
              <dt className="text-muted">Reason</dt>
              <dd>{report.reason.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt className="text-muted">Submitted</dt>
              <dd>{new Date(report.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
          {report.detail && (
            <section className="rounded-card border-subtle mt-5 border p-6">
              <h2 className="font-bold">Reporter context</h2>
              <p className="mt-2 whitespace-pre-wrap">{report.detail}</p>
            </section>
          )}
          {report.status === "submitted" ||
          report.status === "reviewing" ||
          report.targetState === "hidden" ||
          report.targetAccountStatus === "suspended" ? (
            <AdminActionForm
              reportId={report.id}
              reportStatus={report.status}
              targetVersion={report.targetVersion}
              targetState={report.targetState}
              targetKind={report.targetKind}
              targetAccountStatus={report.targetAccountStatus}
            />
          ) : (
            <p className="text-muted mt-8">This report is closed.</p>
          )}
          <HoldForm
            targetKind={report.targetKind}
            targetId={report.targetId}
            holds={report.holds}
          />
        </article>
      </Container>
    </main>
  );
}
