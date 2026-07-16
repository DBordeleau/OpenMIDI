import { notFound } from "next/navigation";
import { requireViewer } from "@/features/auth/guards";
import { projectIdSchema } from "@/features/projects/schema";
import { StudioLauncher } from "@/features/studio/components/studio-launcher.client";
import {
  MIDI_PPQ,
  type WorkspaceManifestV2,
} from "@/features/studio/manifest/v2";
import type { StudioSessionDescriptor } from "@/features/studio/session-contract";
import { CreateWorkspaceForm } from "@/features/workspaces/create-workspace-form";
import { getContributionForViewer } from "@/server/repositories/contributions";
import {
  getMidiStemVersionsByIds,
  listMidiStemVersionsForStudio,
} from "@/server/repositories/midi-stems";
import { listWorkspaceAssetOptions } from "@/server/repositories/revisions";
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
  const options =
    workspace?.manifest.manifestVersion === 1
      ? await listWorkspaceAssetOptions()
      : null;
  const sessionManifest = workspace?.manifest ?? revision?.manifest;
  const referencedMidiVersions =
    sessionManifest?.manifestVersion === 2
      ? await getMidiStemVersionsByIds(
          collectMidiStemVersionIds(sessionManifest),
        )
      : [];
  const ownedMidiVersions =
    workspace &&
    (project.ownerId === viewer.id || workspace.contributionId !== null)
      ? await listMidiStemVersionsForStudio()
      : [];
  const midiVersions = [
    ...new Map(
      [...referencedMidiVersions, ...ownedMidiVersions].map((version) => [
        version.stemVersionId,
        version,
      ]),
    ).values(),
  ];
  const workspaceDurationMs = workspace
    ? workspace.manifest.manifestVersion === 1
      ? Math.max(
          ...workspace.manifest.tracks.map(
            (track) => track.positionMs + track.durationMs,
          ),
        )
      : Math.ceil(
          (workspace.manifest.durationTicks * 60_000) /
            (workspace.manifest.tempoBpm * MIDI_PPQ),
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
          tracks={workspace.tracks}
          assets={(options?.assets ?? []).map((asset) => ({
            id: asset.id,
            filename: asset.filename,
            durationMs: asset.durationMs,
            creditName: asset.creditName,
          }))}
          instruments={options?.instruments ?? []}
          midiVersions={midiVersions}
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
          tracks={workspace.tracks}
          assets={(options?.assets ?? []).map((asset) => ({
            id: asset.id,
            filename: asset.filename,
            durationMs: asset.durationMs,
            creditName: asset.creditName,
          }))}
          instruments={options?.instruments ?? []}
          midiVersions={midiVersions}
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
          tracks={revision.tracks.map(
            ({ trackId, kind, instrumentName, creditName }) => ({
              trackId,
              kind,
              instrumentName,
              creditName,
            }),
          )}
          midiVersions={midiVersions}
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

function collectMidiStemVersionIds(manifest: WorkspaceManifestV2) {
  return manifest.tracks.flatMap((track) =>
    track.kind === "midi"
      ? track.clips.map((clip) => clip.midiStemVersionId)
      : [],
  );
}
