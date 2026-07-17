import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { ProjectRevisionComparisonView } from "@/features/midi-diff/project-revision-comparison.client";
import { projectRevisionComparisonUrl } from "@/features/midi-diff/project-revision-url";
import { getProjectRevisionComparison } from "@/server/repositories/project-revision-comparisons";

export const metadata: Metadata = {
  title: "Compare project revisions · OpenMIDI",
  description:
    "Hear two immutable MIDI revisions side by side and inspect every musical change.",
  robots: { index: false, follow: false },
};

function stringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function ProjectRevisionComparisonPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    from?: string | string[];
    to?: string | string[];
  }>;
}) {
  const [{ projectId }, query] = await Promise.all([params, searchParams]);
  const requested = {
    fromRevisionId: stringParam(query.from),
    toRevisionId: stringParam(query.to),
  };
  const result = await getProjectRevisionComparison({
    projectId,
    ...requested,
  });
  if (result.status === "not_found") notFound();

  if (result.status === "ready") {
    if (
      requested.fromRevisionId !== result.canonicalPair.from ||
      requested.toRevisionId !== result.canonicalPair.to
    ) {
      redirect(
        projectRevisionComparisonUrl({
          projectId,
          ...result.canonicalPair,
        }),
      );
    }
    return (
      <main id="main-content">
        <Container className="py-12 sm:py-16">
          <article className="mx-auto max-w-5xl">
            <Link
              className="text-muted hover:text-accent inline-flex underline"
              href={`/projects/${projectId}#semantic-history`}
            >
              ← Back to project history
            </Link>
            <p className="text-accent mt-8 font-mono text-xs font-semibold tracking-[0.18em] uppercase">
              Immutable revision comparison
            </p>
            <h1 className="mt-2 text-4xl font-bold">
              {result.comparison.project.title}
            </h1>
            <p className="text-muted mt-3 max-w-3xl text-lg">
              Put two moments from this project on the same piano roll. Nothing
              here edits history—this is a read-only listen and look at the
              exact MIDI that was published.
            </p>
            <ProjectRevisionComparisonView comparison={result.comparison} />
            <Link
              className="border-strong hover:border-accent mt-10 inline-flex min-h-11 items-center rounded-full border px-5 font-semibold"
              href={`/projects/${projectId}#semantic-history`}
            >
              Back to project history
            </Link>
          </article>
        </Container>
      </main>
    );
  }

  return (
    <main id="main-content">
      <Container className="py-16">
        <section className="rounded-card border-subtle mx-auto max-w-2xl border border-dashed p-8">
          <p className="text-accent font-mono text-xs font-semibold tracking-[0.18em] uppercase">
            Immutable revision comparison
          </p>
          <h1 className="mt-3 text-3xl font-bold">Comparison unavailable</h1>
          <p className="text-muted mt-4">
            {result.status === "over_limit"
              ? "This project exceeds the safe comparison bounds, so OpenMIDI will not send a partial or misleading diff."
              : "That exact revision pair cannot be read together. A revision may be unavailable, outside this project, or no longer visible to you."}
          </p>
          <Link
            className="border-strong hover:border-accent mt-6 inline-flex min-h-11 items-center rounded-full border px-5 font-semibold"
            href={`/projects/${result.project.id}#semantic-history`}
          >
            Back to project history
          </Link>
        </section>
      </Container>
    </main>
  );
}
