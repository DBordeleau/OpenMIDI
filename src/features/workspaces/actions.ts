"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createWorkspaceSchema,
  publishWorkspaceSchema,
  reserveWorkspaceSnapshotSchema,
  restartWorkspaceSchema,
  saveWorkspaceSchema,
} from "./schema";
import {
  createProjectWorkspace,
  publishWorkspaceRevision,
  reserveWorkspaceSnapshot,
  restartProjectWorkspace,
  saveWorkspace,
} from "@/server/repositories/workspaces";

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
  redirect(`/projects/${projectId}/studio`);
}

export async function reserveWorkspaceSnapshotAction(input: unknown) {
  const parsed = reserveWorkspaceSnapshotSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, code: "invalid_request" as const };
  const { data, error } = await reserveWorkspaceSnapshot(parsed.data);
  if (error || !data?.[0])
    return {
      ok: false as const,
      code:
        error?.code === "PT409"
          ? ("conflict" as const)
          : ("unavailable" as const),
    };
  return {
    ok: true as const,
    assetId: data[0].asset_id,
    bucket: data[0].bucket,
    objectPath: data[0].object_path,
  };
}

export async function saveWorkspaceAction(input: unknown) {
  const parsed = saveWorkspaceSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, code: "invalid_request" as const };
  const { data, error } = await saveWorkspace(parsed.data);
  if (error || !data?.[0])
    return {
      ok: false as const,
      code:
        error?.code === "PT409"
          ? error.message === "workspace_save_conflict"
            ? ("conflict" as const)
            : ("invalid_state" as const)
          : ("unavailable" as const),
    };
  return {
    ok: true as const,
    lockVersion: data[0].lock_version,
    manifestSha256: data[0].manifest_sha256,
    updatedAt: data[0].updated_at,
  };
}

export async function publishWorkspaceAction(
  projectId: string,
  input: unknown,
) {
  const parsed = publishWorkspaceSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, code: "invalid_request" as const };
  const { data, error } = await publishWorkspaceRevision(parsed.data);
  if (error || !data?.[0]) {
    const message = error?.message;
    return {
      ok: false as const,
      code:
        message === "workspace_publish_stale_base"
          ? ("stale_base" as const)
          : error?.code === "PT409"
            ? ("conflict" as const)
            : message === "publish_project_quota_exceeded"
              ? ("quota" as const)
              : ("unavailable" as const),
    };
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/studio`);
  return {
    ok: true as const,
    revisionId: data[0].revision_id,
    revisionNumber: data[0].revision_number,
    workspaceLockVersion: data[0].workspace_lock_version,
  };
}

export async function restartWorkspaceAction(
  projectId: string,
  input: unknown,
) {
  const parsed = restartWorkspaceSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, code: "invalid_request" as const };
  const { data, error } = await restartProjectWorkspace(parsed.data);
  if (error || !data?.[0])
    return {
      ok: false as const,
      code:
        error?.code === "PT409"
          ? ("conflict" as const)
          : ("unavailable" as const),
    };
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/studio`);
  return { ok: true as const, workspaceId: data[0].workspace_id };
}
