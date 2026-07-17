import "server-only";

import {
  parseStudioSessionDescriptor,
  type StudioSessionDescriptor,
} from "@/features/studio/session-contract";
import { getProjectForViewer } from "@/server/repositories/projects";
import { getPublicProject } from "@/server/repositories/public-projects";
import {
  getStudioRevisionV3,
  getStudioWorkspaceV3,
} from "@/server/repositories/studio-v3";

export async function resolveStudioSession(
  projectId: string,
  viewerId: string,
) {
  const [memberProject, workspace] = await Promise.all([
    getProjectForViewer(projectId),
    getStudioWorkspaceV3(projectId),
  ]);
  const publicProject =
    !memberProject &&
    workspace?.ownerId === viewerId &&
    workspace.contributionId
      ? await getPublicProject(projectId)
      : null;
  if (!memberProject && !publicProject) return null;
  const project = memberProject
    ? {
        id: memberProject.id,
        ownerId: memberProject.ownerId,
        title: memberProject.title,
        timeSignature: memberProject.timeSignature,
        license: memberProject.license,
        openToContributions: memberProject.openToContributions,
        currentRevisionId: memberProject.currentRevisionId,
        compatibility: memberProject.compatibility,
      }
    : {
        id: publicProject!.projectId,
        ownerId: publicProject!.ownerId,
        title: publicProject!.title,
        timeSignature:
          publicProject!.timeSignature ?? workspace!.manifest.timeSignature,
        license: publicProject!.license,
        openToContributions: publicProject!.openToContributions,
        currentRevisionId: publicProject!.currentRevisionId,
        compatibility: "midi" as const,
      };
  const revision = project.currentRevisionId
    ? await getStudioRevisionV3({
        projectId,
        revisionId: project.currentRevisionId,
      })
    : null;
  if (!workspace && !revision)
    return { project, workspace: null, revision: null, descriptor: null };
  const owner = project.ownerId === viewerId;
  const workspaceOwner = workspace?.ownerId === viewerId;
  const common = {
    viewerId,
    project: {
      projectId,
      title: project.title,
      compatibility: project.compatibility,
      currentRevisionId: project.currentRevisionId,
    },
    capabilities: {
      canEdit: Boolean(workspace && workspaceOwner),
      canPublish: Boolean(workspace && owner && !workspace.contributionId),
      canSubmit: Boolean(workspace?.contributionId),
      canStartContribution: Boolean(
        revision && !owner && project.openToContributions,
      ),
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
