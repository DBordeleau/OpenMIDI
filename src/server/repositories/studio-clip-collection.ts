import "server-only";

import {
  importStudioClipResultSchema,
  studioClipCollectionSchema,
  studioClipDetailSchema,
  type ImportStudioClipResult,
  type StudioClipCollection,
  type StudioClipDetail,
} from "@/features/studio/clip-collection/schema";
import { sha256ManifestV3 } from "@/features/studio/manifest/v3";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StudioClipRepositoryFailure =
  | "unauthenticated"
  | "actor_ineligible"
  | "workspace_unavailable"
  | "workspace_stale"
  | "saved_source_unavailable"
  | "source_unavailable"
  | "invalid_start_tick"
  | "request_mismatch"
  | "track_limit"
  | "note_limit"
  | "invalid_request"
  | "unavailable";

export class StudioClipRepositoryError extends Error {
  constructor(readonly reason: StudioClipRepositoryFailure) {
    super(`studio_clip_${reason}`);
  }
}

function repositoryError(error: { message?: string } | null) {
  const message = error?.message ?? "";
  const mappings = [
    ["studio_clip_unauthenticated", "unauthenticated"],
    ["studio_clip_actor_ineligible", "actor_ineligible"],
    ["studio_clip_workspace_unavailable", "workspace_unavailable"],
    ["studio_clip_workspace_stale", "workspace_stale"],
    ["studio_clip_saved_source_unavailable", "saved_source_unavailable"],
    ["studio_clip_source_unavailable", "source_unavailable"],
    ["studio_clip_invalid_start_tick", "invalid_start_tick"],
    ["studio_clip_import_request_mismatch", "request_mismatch"],
    ["studio_clip_track_limit", "track_limit"],
    ["studio_clip_note_limit", "note_limit"],
    ["studio_clip_collection_invalid", "invalid_request"],
    ["studio_clip_import_invalid", "invalid_request"],
  ] as const;
  const match = mappings.find(([code]) => message.includes(code));
  return new StudioClipRepositoryError(match?.[1] ?? "unavailable");
}

export async function listStudioClipCollection(input: {
  source: "all" | "owned" | "saved";
  query: string | null;
  limit: number;
}): Promise<StudioClipCollection> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("list_studio_clip_collection", {
    p_source: input.source,
    p_query: input.query ?? undefined,
    p_limit: input.limit,
  });
  if (error) throw repositoryError(error);
  return studioClipCollectionSchema.parse(data);
}

export async function getStudioClipDetail(
  patternVersionId: string,
): Promise<StudioClipDetail> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("get_studio_clip_detail", {
    p_pattern_version_id: patternVersionId,
  });
  if (error) throw repositoryError(error);
  return studioClipDetailSchema.parse(data);
}

export async function importStudioClip(input: {
  patternVersionId: string;
  source: "owned" | "saved";
  workspaceId: string;
  requestId: string;
  expectedWorkspaceLockVersion: number;
  startTick: number;
}): Promise<ImportStudioClipResult> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("import_studio_clip", {
    p_pattern_version_id: input.patternVersionId,
    p_source: input.source,
    p_workspace_id: input.workspaceId,
    p_request_id: input.requestId,
    p_expected_workspace_lock_version: input.expectedWorkspaceLockVersion,
    p_start_tick: input.startTick,
  });
  if (error) throw repositoryError(error);
  const parsed = importStudioClipResultSchema.parse(data);
  if ((await sha256ManifestV3(parsed.manifest)) !== parsed.manifestSha256) {
    throw new StudioClipRepositoryError("unavailable");
  }
  return parsed;
}
