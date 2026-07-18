import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { requireAdmin } from "@/features/auth/guards";
import { AdminChallengeResultsPanel } from "@/features/challenges/admin-results-panel.client";
import { getAdminChallengeResults } from "@/server/repositories/challenges";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Challenge moderation and results" };

export default async function AdminChallengeResultsPage({
  params,
}: {
  params: Promise<{ challengeId: string }>;
}) {
  const { challengeId } = await params;
  await requireAdmin(`/admin/challenges/${challengeId}/results`);
  const data = await getAdminChallengeResults(challengeId);
  if (!data) notFound();
  return (
    <main id="main-content">
      <Container className="py-12 sm:py-16">
        <Link
          href={`/admin/challenges/${challengeId}`}
          className="text-accent underline"
        >
          â† Challenge editor
        </Link>
        <p className="text-accent-2 mt-7 font-mono text-xs tracking-widest uppercase">
          Private administrator authority
        </p>
        <h1 className="mt-3 text-4xl font-bold">
          Voting, moderation, and results
        </h1>
        <p className="text-muted mt-3 max-w-3xl">
          {data.challenge.title} Â· lifecycle authority{" "}
          {data.challenge.lifecycleVersion}. Public totals remain hidden until
          close; reporter evidence stays private.
        </p>
        <AdminChallengeResultsPanel data={data} />
      </Container>
    </main>
  );
}
