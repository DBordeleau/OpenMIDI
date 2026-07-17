import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { requireAdmin } from "@/features/auth/guards";
import { libraryUuidSchema } from "@/features/midi-library/detail";
import { MidiLibraryAdminModerationForm } from "@/features/midi-library/admin-moderation-form.client";
import { getAdminMidiLibraryReport } from "@/server/repositories/midi-library";

export const dynamic = "force-dynamic";

export default async function AdminMidiLibraryReportPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  await requireAdmin("/admin/library-moderation");
  const parsed = libraryUuidSchema.safeParse((await params).reportId);
  if (!parsed.success) notFound();
  const report = await getAdminMidiLibraryReport(parsed.data);
  if (!report) notFound();
  return (
    <main id="main-content">
      <Container className="py-16">
        <Link href="/admin/library-moderation" className="text-muted underline">
          ← Library rights reports
        </Link>
        <article className="mt-7">
          <p className="text-accent-2 font-mono text-xs uppercase">
            Private report evidence
          </p>
          <h1 className="mt-3 text-3xl font-bold">{report.title}</h1>
          <dl className="rounded-card border-subtle mt-6 grid gap-4 border p-6 sm:grid-cols-2">
            <div>
              <dt className="text-muted">Status</dt>
              <dd className="capitalize">{report.status}</dd>
            </div>
            <div>
              <dt className="text-muted">Listing visibility</dt>
              <dd className="capitalize">
                {report.targetState} · version {report.targetVersion}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Claimant role</dt>
              <dd>{report.claimantRole.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt className="text-muted">Submitted</dt>
              <dd>{new Date(report.createdAt).toLocaleString()}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted">Exact evidence target</dt>
              <dd className="mt-1 font-mono text-xs break-all">
                Listing {report.listingId}
                <br />
                Pattern {report.midiPatternId}
                <br />
                Version {report.midiPatternVersionId}
              </dd>
            </div>
          </dl>
          {report.originalWorkTitle && (
            <section className="rounded-card border-subtle mt-5 border p-6">
              <h2 className="font-bold">Claimed original work</h2>
              <p className="mt-2">{report.originalWorkTitle}</p>
              {report.sourceUrl && (
                <a
                  className="text-accent mt-2 inline-block underline"
                  href={report.sourceUrl}
                  rel="noreferrer"
                >
                  Open source evidence
                </a>
              )}
            </section>
          )}
          <section className="rounded-card border-subtle mt-5 border p-6">
            <h2 className="font-bold">Private evidence</h2>
            <p className="mt-2 whitespace-pre-wrap">{report.evidence}</p>
          </section>
          {report.status === "submitted" || report.status === "reviewing" ? (
            <MidiLibraryAdminModerationForm report={report} />
          ) : (
            <p className="text-muted mt-8">
              This report is closed. Its audit records remain private and
              immutable.
            </p>
          )}
        </article>
      </Container>
    </main>
  );
}
