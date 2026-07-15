import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type {
  InstrumentOption,
  PublishAssetOption,
  RevisionSummary,
} from "@/features/revisions/types";
import {
  parseAnyWorkspaceManifest,
  STUDIO_ENGINE_VERSION,
  type VersionedWorkspaceManifest,
} from "@/features/studio/manifest/schema";
import { COMPOSITE_STUDIO_ENGINE_VERSION } from "@/features/studio/manifest/v2";
import type { CreditSnapshot } from "@/features/credits/types";

export type RevisionPlayback = {
  projectId: string;
  revisionId: string;
  revisionNumber: number;
  manifest: VersionedWorkspaceManifest;
  manifestSha256: string;
  durationMs: number;
  tracks: Array<{
    trackId: string;
    kind: "audio" | "midi";
    assetId: string | null;
    displayName: string;
    verifiedDurationMs: number;
    instrumentName: string | null;
    creditName: string;
    credits: CreditSnapshot[];
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
      "id,project_id,revision_number,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,revision_tracks(id,kind,asset_id,name,duration_ms,sort_order,preset_id,preset_version,instruments(name),assets(duration_ms),revision_track_credits(position,credit_name,role,profiles!revision_track_credits_user_id_fkey(username)),revision_midi_track_credits(midi_stem_version_id,creator_credit_name,profiles!revision_midi_track_credits_creator_id_fkey(username)),revision_clips(clip_id,kind,position_ms,trim_start_ms,duration_ms,midi_stem_version_id,start_tick,duration_ticks,source_start_tick,loop))",
    )
    .eq("project_id", input.projectId)
    .eq("id", input.revisionId)
    .maybeSingle();
  if (error) throw new Error("revision_playback_unavailable");
  if (!data) return null;
  const v1 =
    data.manifest_version === 1 &&
    data.engine === "waveform-playlist" &&
    data.engine_version === STUDIO_ENGINE_VERSION;
  const v2 =
    data.manifest_version === 2 &&
    data.engine === "jam-session-composite" &&
    data.engine_version === COMPOSITE_STUDIO_ENGINE_VERSION;
  if (!v1 && !v2) throw new Error("revision_playback_invalid");
  const manifest = parseAnyWorkspaceManifest(data.manifest);
  const { data: checksumValid, error: checksumError } = await db.rpc(
    "revision_manifest_checksum_valid",
    { p_project_id: input.projectId, p_revision_id: input.revisionId },
  );
  if (
    (manifest.manifestVersion === 1
      ? manifest.workspaceId !== input.projectId
      : manifest.projectId !== input.projectId) ||
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
      if (manifest.manifestVersion === 1)
        return (
          !item ||
          !("positionMs" in item) ||
          item.trackId !== track.id ||
          item.assetId !== track.asset_id ||
          item.name !== track.name ||
          item.durationMs !== track.duration_ms ||
          item.sortOrder !== track.sort_order ||
          track.assets?.duration_ms === null
        );
      return (
        !item ||
        !("kind" in item) ||
        item.trackId !== track.id ||
        item.kind !== track.kind ||
        item.name !== track.name ||
        item.sortOrder !== track.sort_order ||
        (item.kind === "audio"
          ? item.assetId !== track.asset_id
          : item.presetId !== track.preset_id ||
            item.presetVersion !== track.preset_version) ||
        item.clips.length !== track.revision_clips.length
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
      kind: track.kind as "audio" | "midi",
      assetId: track.asset_id,
      displayName: track.name,
      verifiedDurationMs: track.assets?.duration_ms ?? track.duration_ms,
      instrumentName: track.instruments?.name ?? null,
      credits:
        track.kind === "midi"
          ? track.revision_midi_track_credits.map((credit, position) => ({
              creditName: credit.creator_credit_name,
              role: "creator" as const,
              position,
              profileUsername: credit.profiles?.username ?? null,
            }))
          : [...track.revision_track_credits]
              .sort((a, b) => a.position - b.position)
              .map((credit) => ({
                creditName: credit.credit_name,
                role: credit.role,
                position: credit.position,
                profileUsername: credit.profiles?.username ?? null,
              })),
      creditName:
        track.kind === "midi"
          ? (track.revision_midi_track_credits[0]?.creator_credit_name ??
            "Unknown creator")
          : track.revision_track_credits.find(
              (credit) => credit.position === 0,
            )!.credit_name,
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
        "id,original_filename,media_type,byte_size,duration_ms,sample_rate_hz,channels,credits_confirmed_at,asset_credits(credit_name,position)",
      )
      .eq("status", "ready")
      .not("credits_confirmed_at", "is", null)
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
  manifest: import("@/features/studio/manifest/schema").WorkspaceManifestV1;
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
      "id,revision_number,message,duration_ms,created_at,revision_attributions(kind,credit_name,profiles!revision_attributions_user_id_fkey(username)),revision_tracks(id,kind,asset_id,name,duration_ms,sort_order,preset_id,preset_version,instruments(name),revision_track_credits(position,credit_name,role,profiles!revision_track_credits_user_id_fkey(username)),revision_midi_track_credits(creator_credit_name,profiles!revision_midi_track_credits_creator_id_fkey(username)))",
    )
    .eq("project_id", projectId)
    .order("revision_number", { ascending: false })
    .limit(20);
  if (error) throw new Error("revision_history_unavailable");
  return data.map((row) => {
    const publisher = row.revision_attributions.find(
      ({ kind }) => kind === "publisher",
    );
    const acceptedContributor = row.revision_attributions.find(
      ({ kind }) => kind === "accepted_contributor",
    );
    if (!publisher) throw new Error("revision_attribution_missing");
    return {
      id: row.id,
      revisionNumber: row.revision_number,
      message: row.message,
      durationMs: row.duration_ms,
      createdAt: row.created_at,
      authorName: publisher.credit_name,
      publisher: {
        creditName: publisher.credit_name,
        profileUsername: publisher.profiles?.username ?? null,
      },
      acceptedContributor: acceptedContributor
        ? {
            creditName: acceptedContributor.credit_name,
            profileUsername: acceptedContributor.profiles?.username ?? null,
          }
        : null,
      tracks: row.revision_tracks
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((track) => {
          const credits =
            track.kind === "midi"
              ? track.revision_midi_track_credits.map((credit, position) => ({
                  creditName: credit.creator_credit_name,
                  role: "creator" as const,
                  position,
                  profileUsername: credit.profiles?.username ?? null,
                }))
              : [...track.revision_track_credits]
                  .sort((a, b) => a.position - b.position)
                  .map((credit) => ({
                    creditName: credit.credit_name,
                    role: credit.role,
                    position: credit.position,
                    profileUsername: credit.profiles?.username ?? null,
                  }));
          if (!credits[0]) throw new Error("revision_credit_missing");
          return {
            id: track.id,
            kind: track.kind as "audio" | "midi",
            assetId: track.asset_id,
            instrumentName: track.instruments?.name ?? null,
            name: track.name,
            durationMs: track.duration_ms,
            sortOrder: track.sort_order,
            creditName: credits[0].creditName,
            credits,
          };
        }),
    };
  });
}
