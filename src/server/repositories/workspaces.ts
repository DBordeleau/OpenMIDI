import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  parseAnyWorkspaceManifest,
  sha256PostgresJsonb,
  STUDIO_ENGINE_VERSION,
  type WorkspaceManifestV1,
} from "@/features/studio/manifest/schema";
import {
  COMPOSITE_STUDIO_ENGINE_VERSION,
  type WorkspaceManifestV2,
} from "@/features/studio/manifest/v2";
import type { EditableWorkspace } from "@/features/workspaces/types";

export async function getActiveWorkspace(
  projectId: string,
): Promise<EditableWorkspace | null> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("workspaces")
    .select(
      "id,project_id,owner_id,contribution_id,snapshot_asset_id,base_revision_id,lock_version,manifest,manifest_version,engine,engine_version,manifest_sha256,created_at,updated_at,workspace_tracks(track_id,asset_id,instrument_id,name,position_ms,trim_start_ms,duration_ms,gain_db,pan,muted,soloed,sort_order,kind,preset_id,preset_version,instruments(name),assets(asset_credits(credit_name,position)),workspace_clips(clip_id,kind,position_ms,trim_start_ms,duration_ms,midi_stem_version_id,start_tick,duration_ticks,source_start_tick,loop,midi_stem_versions(creator_credit_name)))",
    )
    .eq("project_id", projectId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error("workspace_unavailable");
  if (!data) return null;
  const v1 =
    data.manifest_version === 1 &&
    data.engine === "waveform-playlist" &&
    data.engine_version === STUDIO_ENGINE_VERSION;
  const v2 =
    data.manifest_version === 2 &&
    data.engine === "jam-session-composite" &&
    data.engine_version === COMPOSITE_STUDIO_ENGINE_VERSION;
  if ((!v1 && !v2) || (v1 && !data.base_revision_id))
    throw new Error("workspace_invalid");
  const manifest = parseAnyWorkspaceManifest(data.manifest);
  if (
    (manifest.manifestVersion === 1
      ? manifest.workspaceId !== data.project_id
      : manifest.projectId !== data.project_id) ||
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
      if (manifest.manifestVersion === 1)
        return (
          !item ||
          !("positionMs" in item) ||
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
      if (
        !item ||
        !("kind" in item) ||
        item.trackId !== track.track_id ||
        item.kind !== track.kind
      )
        return true;
      const clips = [...track.workspace_clips].sort((left, right) => {
        const leftStart =
          left.kind === "midi" ? left.start_tick! : left.position_ms!;
        const rightStart =
          right.kind === "midi" ? right.start_tick! : right.position_ms!;
        return (
          leftStart - rightStart || left.clip_id.localeCompare(right.clip_id)
        );
      });
      return (
        item.name !== track.name ||
        Number(item.gainDb) !== Number(track.gain_db) ||
        Number(item.pan) !== Number(track.pan) ||
        item.muted !== track.muted ||
        item.soloed !== track.soloed ||
        item.sortOrder !== track.sort_order ||
        (item.kind === "audio"
          ? item.assetId !== track.asset_id
          : item.presetId !== track.preset_id ||
            item.presetVersion !== track.preset_version) ||
        clips.length !== item.clips.length ||
        clips.some((clip, clipIndex) => {
          const expected = item.clips[clipIndex];
          if (!expected || expected.clipId !== clip.clip_id) return true;
          return item.kind === "audio" && "positionMs" in expected
            ? expected.positionMs !== clip.position_ms ||
                expected.trimStartMs !== clip.trim_start_ms ||
                expected.durationMs !== clip.duration_ms
            : "startTick" in expected
              ? expected.midiStemVersionId !== clip.midi_stem_version_id ||
                expected.startTick !== clip.start_tick ||
                expected.durationTicks !== clip.duration_ticks ||
                expected.sourceStartTick !== clip.source_start_tick ||
                expected.loop !== clip.loop
              : true;
        })
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
      kind: track.kind as "audio" | "midi",
      instrumentName: track.instruments?.name ?? null,
      creditName:
        track.kind === "midi"
          ? (track.workspace_clips[0]?.midi_stem_versions
              ?.creator_credit_name ?? "Unknown creator")
          : (track.assets?.asset_credits.find((credit) => credit.position === 0)
              ?.credit_name ?? "Unknown creator"),
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

export async function saveMidiWorkspace(input: {
  workspaceId: string;
  requestId: string;
  expectedLockVersion: number;
  manifest: WorkspaceManifestV2;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("save_midi_workspace", {
    p_workspace_id: input.workspaceId,
    p_request_id: input.requestId,
    p_expected_lock_version: input.expectedLockVersion,
    p_manifest: input.manifest,
  } as unknown as Database["public"]["Functions"]["save_midi_workspace"]["Args"]);
}

export async function publishWorkspaceRevision(input: {
  workspaceId: string;
  requestId: string;
  expectedLockVersion: number;
  expectedBaseRevisionId: string | null;
  message: string | null;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("publish_workspace_revision", {
    p_workspace_id: input.workspaceId,
    p_request_id: input.requestId,
    p_expected_lock_version: input.expectedLockVersion,
    p_expected_base_revision_id: input.expectedBaseRevisionId!,
    p_message: input.message ?? "",
  });
}

export async function publishMidiWorkspaceRevision(input: {
  workspaceId: string;
  requestId: string;
  expectedLockVersion: number;
  expectedBaseRevisionId: string | null;
  message: string | null;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("publish_midi_workspace_revision", {
    p_workspace_id: input.workspaceId,
    p_request_id: input.requestId,
    p_expected_lock_version: input.expectedLockVersion,
    p_expected_base_revision_id: input.expectedBaseRevisionId,
    p_message: input.message ?? "",
  } as unknown as Database["public"]["Functions"]["publish_midi_workspace_revision"]["Args"]);
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
