import "server-only";

import {
  parseStudioSessionDescriptor,
  type StudioSessionDescriptor,
} from "@/features/studio/session-contract";
import { getProjectForViewer } from "@/server/repositories/projects";
import {
  getStudioRevisionV3,
  getStudioWorkspaceV3,
} from "@/server/repositories/studio-v3";

export async function resolveStudioSession(
  projectId: string,
  viewerId: string,
) {
  const project = await getProjectForViewer(projectId);
  if (!project) return null;
  const [workspace, revision] = await Promise.all([
    getStudioWorkspaceV3(projectId),
    project.currentRevisionId
      ? getStudioRevisionV3({
          projectId,
          revisionId: project.currentRevisionId,
        })
      : null,
  ]);
  if (!workspace && !revision)
    return { project, workspace: null, revision: null, descriptor: null };
  const owner = project.ownerId === viewerId;
  const common = {
    viewerId,
    project: {
      projectId,
      title: project.title,
      compatibility: project.compatibility,
      currentRevisionId: project.currentRevisionId,
    },
    capabilities: {
      canEdit: Boolean(workspace && owner),
      canPublish: Boolean(workspace && owner && !workspace.contributionId),
      canSubmit: Boolean(workspace?.contributionId),
      canStartContribution: Boolean(
        revision && !owner && project.openToContributions,
      ),
      canDownloadSources: false,
      canFork: Boolean(revision && project.license.allowsDerivatives),
    },
    canonicalLinks: {
      project: `/projects/${projectId}`,
      studio: `/studio/${projectId}`,
      completion: `/studio/${projectId}`,
    },
  };
  let descriptor: StudioSessionDescriptor;
  if (workspace?.contributionId) {
    descriptor = parseStudioSessionDescriptor({
      mode: "contributionWorkspace",
      ...common,
      manifest: workspace.manifest,
      authority: {
        kind: "contributionWorkspace",
        workspaceId: workspace.id,
        contributionId: workspace.contributionId,
        baseRevisionId: workspace.baseRevisionId,
        lockVersion: workspace.lockVersion,
      },
    });
  } else if (workspace) {
    descriptor = parseStudioSessionDescriptor({
      mode: "ownerWorkspace",
      ...common,
      manifest: workspace.manifest,
      authority: {
        kind: "workspace",
        workspaceId: workspace.id,
        baseRevisionId: workspace.baseRevisionId,
        lockVersion: workspace.lockVersion,
      },
    });
  } else {
    descriptor = parseStudioSessionDescriptor({
      mode: "memberRevision",
      ...common,
      manifest: revision!.manifest,
      authority: {
        kind: "revision",
        revisionId: revision!.revisionId,
        revisionNumber: revision!.revisionNumber,
      },
    });
  }
  return { project, workspace, revision, descriptor };
}
