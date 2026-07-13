import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { requireViewer } from "@/features/auth/guards";
import { ContributionList } from "@/features/contributions/contribution-list";
import { listContributionsByAuthor } from "@/server/repositories/contributions";

export const metadata: Metadata = { title: "Contributions" };

export default async function ContributionsPage() {
  await requireViewer("/contributions");
  const contributions = await listContributionsByAuthor();
  return (
    <main id="main-content">
      <Container className="py-12 sm:py-16">
        <p className="text-accent font-mono text-xs font-semibold tracking-[0.18em] uppercase">
          Private proposals
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Contributions
        </h1>
        <p className="text-muted mt-3 max-w-2xl text-lg">
          Continue private drafts, inspect immutable submissions, and track
          proposals for projects you own.
        </p>
        <ContributionList contributions={contributions} />
      </Container>
    </main>
  );
}
