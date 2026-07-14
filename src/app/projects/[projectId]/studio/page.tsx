import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { requireViewer } from "@/features/auth/guards";
import { projectIdSchema } from "@/features/projects/schema";
import { StudioLauncher } from "@/features/studio/components/studio-launcher.client";
import { CreateWorkspaceForm } from "@/features/workspaces/create-workspace-form";
import { getContributionForViewer } from "@/server/repositories/contributions";
import { getProjectForViewer } from "@/server/repositories/projects";
import {
  getRevisionPlayback,
  listWorkspaceAssetOptions,
} from "@/server/repositories/revisions";
import { getActiveWorkspace } from "@/server/repositories/workspaces";

// Intentionally omit this segment's loading.tsx while using Next.js 16.2.
// Its dev debug channel misidentifies Firefox streaming navigations as cache
// restores and hard-reloads forever. Remove this workaround after upstream
// fix vercel/next.js#94128 ships in the pinned stable release.
export default async function StudioPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  if (!projectIdSchema.safeParse(projectId).success) notFound();
  const viewer = await requireViewer(`/projects/${projectId}/studio`);
  const project = await getProjectForViewer(projectId);
  if (!project) notFound();
  const workspace = await getActiveWorkspace(projectId);
  const contribution = workspace?.contributionId
    ? await getContributionForViewer(workspace.contributionId)
    : null;
  const editable = project.ownerId === viewer.id;
  const revision = project.currentRevisionId
    ? await getRevisionPlayback({
        projectId,
        revisionId: project.currentRevisionId,
      })
    : null;
  const options = workspace ? await listWorkspaceAssetOptions() : null;
  const workspaceDurationMs = workspace
    ? Math.max(
        ...workspace.manifest.tracks.map(
          (track) => track.positionMs + track.durationMs,
        ),
      )
    : 0;

  return (
    <main id="main-content">
      <Container className="py-12">
        <div className="mx-auto max-w-6xl space-y-8">
          <div>
            <Link
              className="text-accent underline"
              href={`/projects/${projectId}`}
            >
              Return to project
            </Link>
            <p className="text-accent mt-6 text-sm font-semibold tracking-widest uppercase">
              {workspace
                ? `Private draft from revision ${revision?.revisionNumber ?? "—"}`
                : `Current revision ${revision?.revisionNumber ?? "—"}`}
            </p>
            <h1 className="mt-2 text-4xl font-bold">{project.title} studio</h1>
            <p className="text-muted mt-3">
              {workspace
                ? "Edit and autosave a private workspace. The published revision remains immutable."
                : "Synchronized playback of the immutable published arrangement."}
            </p>
          </div>
          {workspace && options && contribution ? (
            <StudioLauncher
              mode="contribution"
              projectId={projectId}
              projectTitle={project.title}
              contributionId={contribution.id}
              contributionTitle={contribution.title}
              contributionStatus={contribution.status}
              canEdit={
                contribution.status === "draft" ||
                contribution.status === "changes_requested"
              }
              viewerId={viewer.id}
              workspaceId={workspace.id}
              baseRevisionId={workspace.baseRevisionId}
              currentRevisionId={revision!.revisionId}
              currentRevisionNumber={revision!.revisionNumber}
              lockVersion={workspace.lockVersion}
              manifestSha256={workspace.manifestSha256}
              updatedAt={workspace.updatedAt}
              manifest={workspace.manifest}
              durationMs={workspaceDurationMs}
              tracks={workspace.tracks}
              assets={options.assets.map((asset) => ({
                id: asset.id,
                filename: asset.filename,
                durationMs: asset.durationMs,
                creditName: asset.creditName,
              }))}
              instruments={options.instruments}
            />
          ) : workspace && options ? (
            <StudioLauncher
              mode="workspace"
              projectId={projectId}
              projectTitle={project.title}
              viewerId={viewer.id}
              workspaceId={workspace.id}
              baseRevisionId={workspace.baseRevisionId}
              currentRevisionId={revision!.revisionId}
              currentRevisionNumber={revision!.revisionNumber}
              lockVersion={workspace.lockVersion}
              manifestSha256={workspace.manifestSha256}
              updatedAt={workspace.updatedAt}
              manifest={workspace.manifest}
              durationMs={workspaceDurationMs}
              tracks={workspace.tracks}
              assets={options.assets.map((asset) => ({
                id: asset.id,
                filename: asset.filename,
                durationMs: asset.durationMs,
                creditName: asset.creditName,
              }))}
              instruments={options.instruments}
            />
          ) : revision && editable ? (
            <CreateWorkspaceForm
              projectId={projectId}
              currentRevisionId={revision.revisionId}
              autoStart
            />
          ) : revision ? (
            <StudioLauncher
              mode="revision"
              viewerId={viewer.id}
              projectId={projectId}
              projectTitle={project.title}
              revisionId={revision.revisionId}
              revisionNumber={revision.revisionNumber}
              manifest={revision.manifest}
              durationMs={revision.durationMs}
              tracks={revision.tracks.map(
                ({ trackId, instrumentName, creditName }) => ({
                  trackId,
                  instrumentName,
                  creditName,
                }),
              )}
            />
          ) : (
            <section className="rounded-card border-strong border border-dashed p-8">
              <h2 className="text-xl font-bold">No published revision yet</h2>
              <p className="text-muted mt-2">
                Publish an arrangement before opening the studio.
              </p>
            </section>
          )}
        </div>
      </Container>
    </main>
  );
}
