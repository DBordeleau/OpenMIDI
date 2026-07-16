import { notFound } from "next/navigation";
import { requireViewer } from "@/features/auth/guards";
import { projectIdSchema } from "@/features/projects/schema";
import { StudioLauncher } from "@/features/studio/components/studio-launcher.client";
import { MIDI_V3_PPQ } from "@/features/midi/domain-v3";
import type { ManifestV3 } from "@/features/studio/manifest/v3";
import type { StudioSessionDescriptor } from "@/features/studio/session-contract";
import { CreateWorkspaceForm } from "@/features/workspaces/create-workspace-form";
import { getContributionForViewer } from "@/server/repositories/contributions";
import { loadStudioPatternVersions } from "@/server/repositories/studio-v3";
import { resolveStudioSession } from "@/server/services/studio-session";

// Intentionally omit this segment's loading.tsx while using Next.js 16.2.10.
// Its dev debug channel misidentifies Firefox streaming navigations as cache
// restores and hard-reloads forever. Remove this workaround after upstream
// fix vercel/next.js#94128 ships in the pinned stable release.
export default async function StudioProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  if (!projectIdSchema.safeParse(projectId).success) notFound();
  const viewer = await requireViewer(`/studio/${projectId}`);
  const session = await resolveStudioSession(projectId, viewer.id);
  if (!session) notFound();
  const { project, workspace, revision, descriptor } = session;
  const contribution = workspace?.contributionId
    ? await getContributionForViewer(workspace.contributionId)
    : null;
  const editable = project.ownerId === viewer.id;
  const sessionManifest = workspace?.manifest ?? revision?.manifest;
  const patternVersions = sessionManifest
    ? await loadStudioPatternVersions(sessionManifest)
    : [];
  const workspaceDurationMs = workspace
    ? Math.ceil(
        (workspace.manifest.durationTicks * 60_000) /
          (workspace.manifest.tempoBpm * MIDI_V3_PPQ),
      )
    : 0;
  const launcherKey = descriptor ? sessionAuthorityKey(descriptor) : projectId;

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      {workspace && contribution ? (
        <StudioLauncher
          key={launcherKey}
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
          baseRevisionId={workspace.baseRevisionId!}
          currentRevisionId={revision!.revisionId}
          currentRevisionNumber={revision!.revisionNumber}
          lockVersion={workspace.lockVersion}
          manifestSha256={workspace.manifestSha256}
          updatedAt={workspace.updatedAt}
          manifest={workspace.manifest}
          projectTimeSignature={project.timeSignature}
          durationMs={workspaceDurationMs}
          tracks={studioTrackCredits(workspace.manifest, patternVersions)}
          patternVersions={patternVersions}
        />
      ) : workspace ? (
        <StudioLauncher
          key={launcherKey}
          mode="workspace"
          projectId={projectId}
          projectTitle={project.title}
          viewerId={viewer.id}
          workspaceId={workspace.id}
          baseRevisionId={workspace.baseRevisionId}
          currentRevisionId={revision?.revisionId ?? null}
          currentRevisionNumber={revision?.revisionNumber ?? null}
          lockVersion={workspace.lockVersion}
          manifestSha256={workspace.manifestSha256}
          updatedAt={workspace.updatedAt}
          manifest={workspace.manifest}
          projectTimeSignature={project.timeSignature}
          durationMs={workspaceDurationMs}
          tracks={studioTrackCredits(workspace.manifest, patternVersions)}
          patternVersions={patternVersions}
        />
      ) : revision && editable ? (
        <CreateWorkspaceForm
          projectId={projectId}
          currentRevisionId={revision.revisionId}
          autoStart
        />
      ) : revision ? (
        <StudioLauncher
          key={launcherKey}
          mode="revision"
          viewerId={viewer.id}
          projectId={projectId}
          projectTitle={project.title}
          revisionId={revision.revisionId}
          revisionNumber={revision.revisionNumber}
          manifest={revision.manifest}
          projectTimeSignature={project.timeSignature}
          durationMs={revision.durationMs}
          tracks={studioTrackCredits(revision.manifest, patternVersions)}
          patternVersions={patternVersions}
        />
      ) : (
        <section className="rounded-card border-strong border border-dashed p-8">
          <h2 className="text-xl font-bold">No published revision yet</h2>
          <p className="text-muted mt-2">
            Publish an arrangement before opening the studio.
          </p>
        </section>
      )}
    </section>
  );
}

function sessionAuthorityKey(descriptor: StudioSessionDescriptor) {
  switch (descriptor.mode) {
    case "empty":
      return "empty";
    case "ownerWorkspace":
    case "contributionWorkspace":
      return `${descriptor.project.projectId}:${descriptor.authority.workspaceId}`;
    case "memberRevision":
      return `${descriptor.project.projectId}:${descriptor.authority.revisionId}`;
    case "contributionVersionReview":
      return `${descriptor.project.projectId}:${descriptor.authority.versionId}`;
  }
}

function studioTrackCredits(
  manifest: ManifestV3,
  patterns: Awaited<ReturnType<typeof loadStudioPatternVersions>>,
) {
  const byId = new Map(
    patterns.map((pattern) => [pattern.midiPatternVersionId, pattern]),
  );
  return manifest.tracks.map((track) => ({
    trackId: track.trackId,
    kind: "midi" as const,
    instrumentName: track.presetId,
    creditName:
      byId.get(track.clips[0]?.midiPatternVersionId ?? "")?.creatorCreditName ??
      "You",
  }));
}
