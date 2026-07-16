import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { requireViewer } from "@/features/auth/guards";
import { ReportForm } from "@/features/moderation/report-form";
import { reportTargetKindSchema } from "@/features/moderation/schema";
import { z } from "zod";

export const metadata: Metadata = { title: "Report content" };

export default async function NewReportPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; id?: string; label?: string }>;
}) {
  await requireViewer("/reports/new");
  const query = await searchParams;
  const kind = reportTargetKindSchema.safeParse(query.kind);
  const id = z.uuid().safeParse(query.id);
  if (!kind.success || !id.success) notFound();
  return (
    <main id="main-content">
      <Container className="py-16">
        <section className="mx-auto max-w-2xl">
          <p className="text-accent-2 font-mono text-xs uppercase">
            Private report
          </p>
          <h1 className="mt-3 text-4xl font-bold">Report a concern</h1>
          <p className="text-muted mt-4">
            Reports are reviewed manually and never hide content automatically.
            The person you report won’t see your report or its details.
          </p>
          {query.label && (
            <p className="rounded-control border-subtle mt-5 border p-4">
              Reporting: {query.label.slice(0, 160)}
            </p>
          )}
          <ReportForm targetKind={kind.data} targetId={id.data} />
          <Link
            className="text-accent mt-6 inline-block underline"
            href="/community-rules"
          >
            Read the community rules
          </Link>
        </section>
      </Container>
    </main>
  );
}
