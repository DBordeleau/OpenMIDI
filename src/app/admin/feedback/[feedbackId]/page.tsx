import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Container } from "@/components/layout/container";
import { requireAdmin } from "@/features/auth/guards";
import { AdminFeedbackActions } from "@/features/feedback/admin-feedback-actions.client";
import { getAdminFeedback } from "@/server/repositories/feedback";

export const dynamic = "force-dynamic";

export default async function AdminFeedbackDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ feedbackId: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  await requireAdmin("/admin/feedback");
  const id = z.uuid().safeParse((await params).feedbackId);
  if (!id.success) notFound();
  const feedback = await getAdminFeedback(id.data);
  if (!feedback) notFound();
  const query = await searchParams;

  return (
    <main id="main-content">
      <Container className="py-12 sm:py-16">
        <article className="mx-auto max-w-3xl">
          <Link href="/admin/feedback" className="text-accent font-semibold">
            ← Back to feedback queue
          </Link>
          <p className="text-accent-2 mt-8 font-mono text-xs uppercase">
            Private administrator detail
          </p>
          <h1 className="mt-3 text-3xl font-bold">{feedback.summary}</h1>
          <p className="text-muted mt-2 font-mono text-sm">
            {feedback.referenceId}
          </p>
          {query.updated && (
            <p
              role="status"
              className="border-accent rounded-control mt-6 border p-4"
            >
              Feedback updated.
            </p>
          )}

          <dl className="rounded-card border-subtle bg-surface mt-6 grid gap-5 border p-6 sm:grid-cols-2">
            <div>
              <dt className="text-muted text-sm">Kind</dt>
              <dd className="mt-1 capitalize">{feedback.kind}</dd>
            </div>
            <div>
              <dt className="text-muted text-sm">Status</dt>
              <dd className="mt-1 capitalize">{feedback.status}</dd>
            </div>
            <div>
              <dt className="text-muted text-sm">Source pathname</dt>
              <dd className="mt-1 font-mono break-all">
                {feedback.sourcePathname}
              </dd>
            </div>
            <div>
              <dt className="text-muted text-sm">Application version</dt>
              <dd className="mt-1 font-mono break-all">
                {feedback.applicationVersion}
              </dd>
            </div>
            <div>
              <dt className="text-muted text-sm">Submitted</dt>
              <dd className="mt-1">
                <time dateTime={feedback.createdAt}>
                  {new Date(feedback.createdAt).toLocaleString()}
                </time>
              </dd>
            </div>
            <div>
              <dt className="text-muted text-sm">Submitter</dt>
              <dd className="mt-1">
                {feedback.submitterUsername
                  ? `@${feedback.submitterUsername}`
                  : "Unavailable profile"}
              </dd>
            </div>
          </dl>

          <section className="rounded-card border-subtle mt-5 border p-6">
            <h2 className="font-bold">Submitted details</h2>
            <p className="mt-3 whitespace-pre-wrap">{feedback.details}</p>
          </section>
          <section className="rounded-card border-subtle mt-5 border p-6">
            <h2 className="font-bold">Opt-in browser/platform context</h2>
            <p className="text-muted mt-3 whitespace-pre-wrap">
              {feedback.browserContext ?? "Not shared"}
            </p>
          </section>
          {feedback.adminNote && (
            <section className="rounded-card border-subtle mt-5 border p-6">
              <h2 className="font-bold">Private handled note</h2>
              <p className="mt-3 whitespace-pre-wrap">{feedback.adminNote}</p>
            </section>
          )}

          <AdminFeedbackActions feedback={feedback} />
        </article>
      </Container>
    </main>
  );
}
