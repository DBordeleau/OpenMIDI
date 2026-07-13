import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type {
  InstrumentOption,
  PublishAssetOption,
  RevisionSummary,
} from "@/features/revisions/types";
import type { WorkspaceManifestV1 } from "@/features/studio/manifest/schema";

export async function listPublishOptions(): Promise<{
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
