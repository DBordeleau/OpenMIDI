"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createWorkspaceSchema,
  publishWorkspaceSchema,
  resolveStaleOwnerWorkspaceSchema,
  saveMidiWorkspaceV3Schema,
} from "./schema";
import {
  createProjectWorkspace,
  resolveStaleOwnerWorkspace,
  StaleDraftResolutionRepositoryError,
  type StaleDraftResolutionFailure,
} from "@/server/repositories/workspaces";
import {
  publishMidiWorkspaceRevisionV3,
  saveMidiWorkspaceV3,
} from "@/server/repositories/midi-v3";

export type CreateWorkspaceState = { message?: string };

export async function createWorkspaceAction(
  projectId: string,
  _state: CreateWorkspaceState,
  formData: FormData,
): Promise<CreateWorkspaceState> {
  const parsed = createWorkspaceSchema.safeParse({
    requestId: formData.get("requestId"),
    expectedCurrentRevisionId: formData.get("expectedCurrentRevisionId"),
  });
  if (!parsed.success) return { message: "Reload and try creating the draft." };
  const { data, error } = await createProjectWorkspace({
    projectId,
    ...parsed.data,
  });
  if (error || !data?.[0])
    return {
      message:
        error?.code === "PT409"
          ? "The project revision changed. Reload before creating a draft."
          : "We couldn’t create this private draft.",
    };
  redirect(`/studio/${projectId}`);
}

export async function saveMidiWorkspaceV3Action(input: unknown) {
  const parsed = saveMidiWorkspaceV3Schema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, code: "invalid_request" as const };
  try {
    const saved = await saveMidiWorkspaceV3({
      ...parsed.data,
      manifest: parsed.data.manifest,
    });
    return {
      ok: true as const,
      lockVersion: saved.lock_version,
      manifestSha256: saved.manifest_sha256,
      updatedAt: saved.updated_at,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return {
      ok: false as const,
      code: message.includes("conflict")
        ? ("conflict" as const)
        : message.includes("not_found")
          ? ("invalid_state" as const)
          : ("unavailable" as const),
    };
  }
}

export async function publishMidiWorkspaceV3Action(
  projectId: string,
  input: unknown,
) {
  const parsed = publishWorkspaceSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, code: "invalid_request" as const };
  try {
    const published = await publishMidiWorkspaceRevisionV3({
      workspaceId: parsed.data.workspaceId,
      requestId: parsed.data.requestId,
      expectedWorkspaceLockVersion: parsed.data.expectedLockVersion,
      expectedBaseRevisionId: parsed.data.expectedBaseRevisionId,
      message: parsed.data.message,
    });
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/studio/${projectId}`);
    revalidatePath("/explore");
    return {
      ok: true as const,
      revisionId: published.revision_id,
      revisionNumber: published.revision_number,
      arrangementVersionId: published.arrangement_version_id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return {
      ok: false as const,
      code: message.includes("stale")
        ? ("stale_base" as const)
        : message.includes("conflict")
          ? ("conflict" as const)
          : ("unavailable" as const),
    };
  }
}

export type ResolveStaleDraftResult =
  | {
      ok: true;
      resolution: "restart_latest" | "preserve_as_fork";
      targetProjectId: string;
      targetWorkspaceId: string;
      targetBaseRevisionId: string;
      targetLockVersion: number;
    }
  | {
      ok: false;
      code: StaleDraftResolutionFailure;
    };

export async function resolveStaleOwnerDraftAction(
  input: unknown,
): Promise<ResolveStaleDraftResult> {
  const parsed = resolveStaleOwnerWorkspaceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid_request" };

  try {
    const resolved = await resolveStaleOwnerWorkspace(parsed.data);
    revalidatePath("/dashboard");
    revalidatePath("/projects");
    revalidatePath("/studio", "layout");
    revalidatePath(`/projects/${resolved.source_project_id}`);
    revalidatePath(`/studio/${resolved.source_project_id}`);
    revalidatePath(`/projects/${resolved.target_project_id}`);
    revalidatePath(`/studio/${resolved.target_project_id}`);

    return {
      ok: true,
      resolution: resolved.resolution,
      targetProjectId: resolved.target_project_id,
      targetWorkspaceId: resolved.target_workspace_id,
      targetBaseRevisionId: resolved.target_base_revision_id,
      targetLockVersion: resolved.target_workspace_lock_version,
    };
  } catch (error) {
    return {
      ok: false,
      code:
        error instanceof StaleDraftResolutionRepositoryError
          ? error.reason
          : "unavailable",
    };
  }
}
