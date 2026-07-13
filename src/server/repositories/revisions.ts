import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type {
  InstrumentOption,
  PublishAssetOption,
  RevisionSummary,
} from "@/features/revisions/types";
import {
  parseVersionedWorkspaceManifest,
  STUDIO_ENGINE_VERSION,
  type WorkspaceManifestV1,
} from "@/features/studio/manifest/schema";

export type RevisionPlayback = {
  projectId: string;
  revisionId: string;
  revisionNumber: number;
  manifest: WorkspaceManifestV1;
  manifestSha256: string;
  durationMs: number;
  tracks: Array<{
    trackId: string;
    assetId: string;
    displayName: string;
    verifiedDurationMs: number;
    instrumentName: string | null;
    creditName: string;
  }>;
};

export async function getRevisionPlayback(input: {
  projectId: string;
  revisionId: string;
}): Promise<RevisionPlayback | null> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("project_revisions")
    .select(
      "id,project_id,revision_number,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,revision_tracks(id,asset_id,name,duration_ms,sort_order,instruments(name),assets(duration_ms,asset_credits(credit_name,position)))",
    )
    .eq("project_id", input.projectId)
    .eq("id", input.revisionId)
    .maybeSingle();
  if (error) throw new Error("revision_playback_unavailable");
  if (!data) return null;
  if (
    data.manifest_version !== 1 ||
    data.engine !== "waveform-playlist" ||
    data.engine_version !== STUDIO_ENGINE_VERSION
  )
    throw new Error("revision_playback_invalid");
  const manifest = parseVersionedWorkspaceManifest(data.manifest);
  const { data: checksumValid, error: checksumError } = await db.rpc(
    "revision_manifest_checksum_valid",
    { p_project_id: input.projectId, p_revision_id: input.revisionId },
  );
  if (
    manifest.workspaceId !== input.projectId ||
    checksumError ||
    checksumValid !== true
  )
    throw new Error("revision_playback_invalid");
  const normalized = [...data.revision_tracks].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  if (
    normalized.length !== manifest.tracks.length ||
    normalized.some((track, index) => {
      const item = manifest.tracks[index];
      return (
        !item ||
        item.trackId !== track.id ||
        item.assetId !== track.asset_id ||
        item.name !== track.name ||
        item.durationMs !== track.duration_ms ||
        item.sortOrder !== track.sort_order ||
        track.assets.duration_ms === null
      );
    })
  )
    throw new Error("revision_playback_invalid");
  return {
    projectId: data.project_id,
    revisionId: data.id,
    revisionNumber: data.revision_number,
    manifest,
    manifestSha256: data.manifest_sha256,
    durationMs: data.duration_ms,
    tracks: normalized.map((track) => ({
      trackId: track.id,
      assetId: track.asset_id,
      displayName: track.name,
      verifiedDurationMs: track.assets.duration_ms!,
      instrumentName: track.instruments?.name ?? null,
      creditName:
        track.assets.asset_credits.find((credit) => credit.position === 0)
          ?.credit_name ?? "Unknown creator",
    })),
  };
}

export async function listWorkspaceAssetOptions(): Promise<{
  assets: PublishAssetOption[];
  instruments: InstrumentOption[];
}> {
  const db = await createSupabaseServerClient();
  const [assets, instruments] = await Promise.all([
    db
      .from("assets")
      .select(
        "id,original_filename,media_type,byte_size,duration_ms,sample_rate_hz,channels,asset_credits(credit_name,position)",
      )
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(30),
    db
      .from("instruments")
      .select("id,name")
      .eq("is_active", true)
      .order("sort_order"),
  ]);
  if (assets.error || instruments.error)
    throw new Error("publish_options_unavailable");
  return {
    assets: assets.data.flatMap((row) =>
      row.media_type &&
      row.byte_size &&
      row.duration_ms &&
      row.sample_rate_hz &&
      row.channels
        ? [
            {
              id: row.id,
              filename: row.original_filename,
              mediaType: row.media_type,
              byteSize: Number(row.byte_size),
              durationMs: row.duration_ms,
              sampleRateHz: row.sample_rate_hz,
              channels: row.channels,
              creditName:
                row.asset_credits.find((credit) => credit.position === 0)
                  ?.credit_name ?? "Unknown creator",
            },
          ]
        : [],
    ),
    instruments: instruments.data,
  };
}

export const listPublishOptions = listWorkspaceAssetOptions;

export async function publishRevision(input: {
  projectId: string;
  requestId: string;
  expectedCurrentRevisionId: string | null;
  message: string | null;
  manifest: WorkspaceManifestV1;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("publish_project_revision", {
    p_project_id: input.projectId,
    p_request_id: input.requestId,
    p_expected_current_revision_id: input.expectedCurrentRevisionId,
    p_message: input.message,
    p_manifest: input.manifest,
  } as unknown as Database["public"]["Functions"]["publish_project_revision"]["Args"]);
}

export async function getRevisionHistory(
  projectId: string,
): Promise<RevisionSummary[]> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("project_revisions")
    .select(
      "id,revision_number,message,duration_ms,created_at,profiles!project_revisions_created_by_fkey(credit_name),revision_tracks(id,asset_id,name,duration_ms,sort_order,instruments(name),assets(asset_credits(credit_name,position)))",
    )
    .eq("project_id", projectId)
    .order("revision_number", { ascending: false })
    .limit(20);
  if (error) throw new Error("revision_history_unavailable");
  return data.map((row) => ({
    id: row.id,
    revisionNumber: row.revision_number,
    message: row.message,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
    authorName: row.profiles.credit_name ?? "Unknown author",
    tracks: row.revision_tracks
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((track) => ({
        id: track.id,
        assetId: track.asset_id,
        instrumentName: track.instruments?.name ?? null,
        name: track.name,
        durationMs: track.duration_ms,
        sortOrder: track.sort_order,
        creditName:
          track.assets.asset_credits.find((credit) => credit.position === 0)
            ?.credit_name ?? "Unknown creator",
      })),
  }));
}
