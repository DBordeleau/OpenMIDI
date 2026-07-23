import "server-only";

import {
  staleOwnerWorkspaceResolutionRowSchema,
  type ResolveStaleOwnerWorkspaceInput,
  type StaleOwnerWorkspaceResolutionRow,
} from "@/features/workspaces/schema";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StaleDraftResolutionFailure =
  | "invalid_request"
  | "workspace_changed"
  | "project_changed"
  | "not_stale"
  | "forbidden"
  | "unavailable";

export class StaleDraftResolutionRepositoryError extends Error {
  constructor(readonly reason: StaleDraftResolutionFailure) {
    super(`stale_draft_resolution_${reason}`);
    this.name = "StaleDraftResolutionRepositoryError";
  }
}

export async function createProjectWorkspace(input: {
  projectId: string;
  requestId: string;
  expectedCurrentRevisionId: string;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("create_project_workspace_v3", {
    p_project_id: input.projectId,
    p_request_id: input.requestId,
    p_expected_current_revision_id: input.expectedCurrentRevisionId,
  });
}

export async function resolveStaleOwnerWorkspace(
  input: ResolveStaleOwnerWorkspaceInput,
): Promise<StaleOwnerWorkspaceResolutionRow> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("resolve_stale_owner_workspace_v3", {
    p_workspace_id: input.workspaceId,
    p_request_id: input.requestId,
    p_expected_workspace_lock_version: input.expectedWorkspaceLockVersion,
    p_expected_base_revision_id: input.expectedBaseRevisionId,
    p_expected_current_revision_id: input.expectedCurrentRevisionId,
    p_resolution: input.resolution,
    p_fork_title: input.forkTitle,
  } as unknown as Database["public"]["Functions"]["resolve_stale_owner_workspace_v3"]["Args"]);

  if (error) {
    if (
      error.code === "22023" ||
      error.message === "draft_resolution_invalid_input" ||
      error.message === "draft_resolution_request_conflict"
    ) {
      throw new StaleDraftResolutionRepositoryError("invalid_request");
    }
    if (error.message === "draft_resolution_workspace_changed") {
      throw new StaleDraftResolutionRepositoryError("workspace_changed");
    }
    if (error.message === "draft_resolution_project_changed") {
      throw new StaleDraftResolutionRepositoryError("project_changed");
    }
    if (error.message === "draft_resolution_not_stale") {
      throw new StaleDraftResolutionRepositoryError("not_stale");
    }
    if (
      error.code === "PT401" ||
      error.code === "PT403" ||
      error.code === "PT404"
    ) {
      throw new StaleDraftResolutionRepositoryError("forbidden");
    }
    throw new StaleDraftResolutionRepositoryError("unavailable");
  }

  const parsed = staleOwnerWorkspaceResolutionRowSchema.safeParse(data?.[0]);
  if (!parsed.success) {
    throw new StaleDraftResolutionRepositoryError("unavailable");
  }
  return parsed.data;
}
