import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  parseVersionedWorkspaceManifest,
  sha256PostgresJsonb,
  STUDIO_ENGINE_VERSION,
  type WorkspaceManifestV1,
} from "@/features/studio/manifest/schema";
import type { EditableWorkspace } from "@/features/workspaces/types";

export async function getActiveWorkspace(
  projectId: string,
): Promise<EditableWorkspace | null> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("workspaces")
    .select(
      "id,project_id,owner_id,contribution_id,snapshot_asset_id,base_revision_id,lock_version,manifest,manifest_version,engine,engine_version,manifest_sha256,created_at,updated_at,workspace_tracks(track_id,asset_id,instrument_id,name,position_ms,trim_start_ms,duration_ms,gain_db,pan,muted,soloed,sort_order,instruments(name),assets(asset_credits(credit_name,position)))",
    )
    .eq("project_id", projectId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error("workspace_unavailable");
  if (!data) return null;
  if (
    !data.base_revision_id ||
    data.manifest_version !== 1 ||
    data.engine !== "waveform-playlist" ||
    data.engine_version !== STUDIO_ENGINE_VERSION
  )
    throw new Error("workspace_invalid");
  const manifest = parseVersionedWorkspaceManifest(data.manifest);
  if (
    manifest.workspaceId !== data.project_id ||
    (await sha256PostgresJsonb(manifest)) !== data.manifest_sha256
  )
    throw new Error("workspace_invalid");
  const projected = [...data.workspace_tracks].sort(
    (left, right) => left.sort_order - right.sort_order,
  );
  if (
    projected.length !== manifest.tracks.length ||
    projected.some((track, index) => {
      const item = manifest.tracks[index];
      return (
        !item ||
        item.trackId !== track.track_id ||
        item.assetId !== track.asset_id ||
        item.instrumentId !== track.instrument_id ||
        item.name !== track.name ||
        item.positionMs !== track.position_ms ||
        item.trimStartMs !== track.trim_start_ms ||
        item.durationMs !== track.duration_ms ||
        Number(item.gainDb) !== Number(track.gain_db) ||
        Number(item.pan) !== Number(track.pan) ||
        item.muted !== track.muted ||
        item.soloed !== track.soloed ||
        item.sortOrder !== track.sort_order
      );
    })
  )
    throw new Error("workspace_invalid");
  return {
    id: data.id,
    projectId: data.project_id,
    ownerId: data.owner_id,
    contributionId: data.contribution_id,
    snapshotAssetId: data.snapshot_asset_id,
    baseRevisionId: data.base_revision_id,
    lockVersion: data.lock_version,
    manifest,
    manifestSha256: data.manifest_sha256,
    updatedAt: data.updated_at,
    createdAt: data.created_at,
    tracks: projected.map((track) => ({
      trackId: track.track_id,
      assetId: track.asset_id,
      instrumentName: track.instruments?.name ?? null,
      creditName:
        track.assets.asset_credits.find((credit) => credit.position === 0)
          ?.credit_name ?? "Unknown creator",
    })),
  };
}

export async function createProjectWorkspace(input: {
  projectId: string;
  requestId: string;
  expectedCurrentRevisionId: string;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("create_project_workspace", {
    p_project_id: input.projectId,
    p_request_id: input.requestId,
    p_expected_current_revision_id: input.expectedCurrentRevisionId,
  });
}

export async function reserveWorkspaceSnapshot(input: {
  workspaceId: string;
  requestId: string;
  expectedLockVersion: number;
  manifestSha256: string;
  byteSize: number;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("reserve_workspace_snapshot", {
    p_workspace_id: input.workspaceId,
    p_request_id: input.requestId,
    p_expected_lock_version: input.expectedLockVersion,
    p_manifest_sha256: input.manifestSha256,
    p_byte_size: input.byteSize,
  });
}

export async function saveWorkspace(input: {
  workspaceId: string;
  requestId: string;
  expectedLockVersion: number;
  snapshotAssetId: string;
  manifest: WorkspaceManifestV1;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("save_workspace", {
    p_workspace_id: input.workspaceId,
    p_request_id: input.requestId,
    p_expected_lock_version: input.expectedLockVersion,
    p_snapshot_asset_id: input.snapshotAssetId,
    p_manifest:
      input.manifest as unknown as Database["public"]["Functions"]["save_workspace"]["Args"]["p_manifest"],
  });
}

export async function publishWorkspaceRevision(input: {
  workspaceId: string;
  requestId: string;
  expectedLockVersion: number;
  expectedBaseRevisionId: string;
  message: string | null;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("publish_workspace_revision", {
    p_workspace_id: input.workspaceId,
    p_request_id: input.requestId,
    p_expected_lock_version: input.expectedLockVersion,
    p_expected_base_revision_id: input.expectedBaseRevisionId,
    p_message: input.message ?? "",
  });
}

export async function restartProjectWorkspace(input: {
  workspaceId: string;
  requestId: string;
  expectedLockVersion: number;
  expectedBaseRevisionId: string;
  expectedCurrentRevisionId: string;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("restart_project_workspace", {
    p_workspace_id: input.workspaceId,
    p_request_id: input.requestId,
    p_expected_lock_version: input.expectedLockVersion,
    p_expected_base_revision_id: input.expectedBaseRevisionId,
    p_expected_current_revision_id: input.expectedCurrentRevisionId,
  });
}
