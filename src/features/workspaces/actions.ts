"use server";

import { redirect } from "next/navigation";
import {
  createWorkspaceSchema,
  reserveWorkspaceSnapshotSchema,
  saveWorkspaceSchema,
} from "./schema";
import {
  createProjectWorkspace,
  reserveWorkspaceSnapshot,
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
