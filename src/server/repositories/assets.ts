import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OwnedSourceAsset } from "@/features/assets/types";
import type { Database } from "@/lib/supabase/database.types";

export async function listOwnedSourceAssets(): Promise<OwnedSourceAsset[]> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("assets")
    .select(
      "id,original_filename,status,media_type,byte_size,duration_ms,sample_rate_hz,channels,failure_code,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error("uploads_unavailable");
  return data.map((row) => ({
    id: row.id,
    filename: row.original_filename,
    status: row.status as OwnedSourceAsset["status"],
    mediaType: row.media_type,
    byteSize: row.byte_size === null ? null : Number(row.byte_size),
    durationMs: row.duration_ms,
    sampleRateHz: row.sample_rate_hz,
    channels: row.channels,
    failureCode: row.failure_code,
    createdAt: row.created_at,
  }));
}

export async function reserveSourceAsset(input: {
  requestId: string;
  byteSize: number;
  filename: string;
  mediaType: string | null;
  durationMs: number | null;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("reserve_source_asset", {
    p_request_id: input.requestId,
    p_expected_byte_size: input.byteSize,
    p_filename: input.filename,
    p_declared_media_type: input.mediaType,
    p_client_duration_ms: input.durationMs,
    p_expected_sha256: null,
  } as unknown as Database["public"]["Functions"]["reserve_source_asset"]["Args"]);
}
export async function completeSourceAsset(assetId: string) {
  const db = await createSupabaseServerClient();
  return db.rpc("complete_source_upload", { p_asset_id: assetId } as never);
}
export async function cancelSourceAsset(assetId: string) {
  const db = await createSupabaseServerClient();
  return db.rpc("cancel_source_upload", { p_asset_id: assetId } as never);
}
