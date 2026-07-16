import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { requireViewer } from "@/features/auth/guards";
import { ForkProjectForm } from "@/features/forks/fork-project-form";
import { projectIdSchema } from "@/features/projects/schema";
import { getForkSourceForViewer } from "@/server/repositories/forks";

export default async function ForkProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ revision?: string }>;
}) {
  const { projectId } = await params;
  const { revision } = await searchParams;
  if (
    !projectIdSchema.safeParse(projectId).success ||
    !projectIdSchema.safeParse(revision).success
  )
    notFound();
  const viewer = await requireViewer(
    `/projects/${projectId}/fork?revision=${revision}`,
  );
  if (!viewer.profileCompletedAt) redirect("/onboarding");

  const source = await getForkSourceForViewer({
    projectId,
    revisionId: revision!,
  });
  if (!source) notFound();

  return (
    <main id="main-content">
      <Container className="py-12 sm:py-16">
        <article className="mx-auto max-w-2xl">
          <Link
            className="text-accent underline"
            href={`/projects/${projectId}`}
          >
            Return to project
          </Link>
          <p className="text-accent mt-8 font-mono text-xs font-semibold tracking-widest uppercase">
            Fork revision {source.revisionNumber}
          </p>
          <h1 className="mt-3 text-4xl font-bold">
            Create your own version of {source.projectTitle}
          </h1>
          <p className="text-muted mt-4 leading-7">
            This creates a separate private project that you own. The existing
            immutable MIDI pattern versions are reused copy-on-write with exact
            creator and source lineage.
          </p>
          <dl className="rounded-card border-subtle bg-surface mt-8 grid gap-5 border p-6 sm:grid-cols-2">
            <div>
              <dt className="text-muted">Exact source</dt>
              <dd>Revision {source.revisionNumber}</dd>
            </div>
            <div>
              <dt className="text-muted">Arrangement</dt>
              <dd>
                {source.trackCount}{" "}
                {source.trackCount === 1 ? "track" : "tracks"} ·{" "}
                {(source.durationMs / 1000).toFixed(1)} seconds
              </dd>
            </div>
            <div>
              <dt className="text-muted">Visibility</dt>
              <dd>Private</dd>
            </div>
            <div>
              <dt className="text-muted">Contributions</dt>
              <dd>Closed by default</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted">Inherited license</dt>
              <dd>
                <a className="underline" href={source.license.url}>
                  {source.license.name}
                </a>
                {source.license.shareAlike && " · Share-alike applies"}
                {source.license.requiresAttribution &&
                  " · Attribution required"}
              </dd>
            </div>
          </dl>
          {source.license.allowsDerivatives ? (
            <>
              <p className="text-muted mt-6">
                No editable workspace is created yet. Open the new project’s
                studio afterward when you are ready to start editing.
              </p>
              <ForkProjectForm source={source} />
            </>
          ) : (
            <p className="rounded-control border-subtle mt-8 border p-4 font-semibold">
              This license does not permit derivative forks.
            </p>
          )}
        </article>
      </Container>
    </main>
  );
}
