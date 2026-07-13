import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { requireViewer } from "@/features/auth/guards";
import { projectIdSchema } from "@/features/projects/schema";
import { InitialPublishForm } from "@/features/revisions/initial-publish-form";
import { getProjectForViewer } from "@/server/repositories/projects";
import { listPublishOptions } from "@/server/repositories/revisions";
export default async function PublishPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireViewer(`/projects/${projectId}/publish`);
  if (!projectIdSchema.safeParse(projectId).success) notFound();
  const project = await getProjectForViewer(projectId);
  if (!project) notFound();
  const { assets, instruments } = await listPublishOptions();
  return (
    <main id="main-content">
      <Container className="py-16">
        <div className="mx-auto max-w-3xl">
          <p className="text-accent font-semibold">Private first publish</p>
          <h1 className="mt-2 text-4xl font-bold">Publish {project.title}</h1>
          {project.currentRevisionId ? (
            <p className="mt-6">
              This project already has a published revision.{" "}
              <Link className="underline" href={`/projects/${projectId}`}>
                Return to project
              </Link>
              .
            </p>
          ) : project.bpm === null ? (
            <p className="mt-6">
              A project tempo is required.{" "}
              <Link className="underline" href={`/projects/${projectId}/edit`}>
                Set project metadata
              </Link>
              .
            </p>
          ) : assets.length === 0 ? (
            <p className="mt-6">
              You need a verified ready source asset.{" "}
              <Link className="underline" href="/uploads">
                Go to My uploads
              </Link>
              .
            </p>
          ) : (
            <InitialPublishForm
              projectId={projectId}
              assets={assets}
              instruments={instruments}
            />
          )}
        </div>
      </Container>
    </main>
  );
}
