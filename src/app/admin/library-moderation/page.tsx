import Link from "next/link";
import { Container } from "@/components/layout/container";
import { requireAdmin } from "@/features/auth/guards";
import { listAdminMidiLibraryReports } from "@/server/repositories/midi-library";

export const dynamic = "force-dynamic";

export default async function AdminMidiLibraryModerationPage() {
  await requireAdmin("/admin/library-moderation");
  const reports = await listAdminMidiLibraryReports();
  return (
    <main id="main-content">
      <Container className="py-16">
        <p className="text-accent-2 font-mono text-xs uppercase">
          Private administrator queue
        </p>
        <h1 className="mt-3 text-4xl font-bold">Library rights reports</h1>
        <p className="text-muted mt-4 max-w-2xl">
          Claimant identity, sources, and evidence stay private. Reports never
          change visibility until an administrator records a hide or restore
          action.
        </p>
        <Link
          href="/admin/moderation"
          className="text-accent mt-5 inline-block underline"
        >
          General moderation queue
        </Link>
        {reports.length ? (
          <ul className="mt-8 space-y-3">
            {reports.map((report) => (
              <li
                key={report.id}
                className="rounded-card border-subtle bg-surface border p-5"
              >
                <Link
                  className="text-lg font-semibold underline"
                  href={`/admin/library-moderation/${report.id}`}
                >
                  {report.title}
                </Link>
                <p className="text-muted mt-1 text-sm">
                  {report.claimantRole.replaceAll("_", " ")} · {report.status} ·{" "}
                  {new Date(report.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted mt-8">The library report queue is clear.</p>
        )}
      </Container>
    </main>
  );
}
