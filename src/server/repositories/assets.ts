import "server-only";
import { FunctionRegion } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AssetVerificationStatus,
  OwnedSourceAsset,
} from "@/features/assets/types";
import type { Database } from "@/lib/supabase/database.types";

export async function listOwnedSourceAssets(): Promise<OwnedSourceAsset[]> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("assets")
    .select(
      "id,original_filename,status,media_type,byte_size,duration_ms,sample_rate_hz,channels,failure_code,created_at,credits_confirmed_at,owner_id,asset_credits(credit_name,role,position,user_id)",
    )
    .eq("kind", "source_audio")
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
    creditsConfirmedAt: row.credits_confirmed_at,
    credits: [...row.asset_credits]
      .sort((a, b) => a.position - b.position)
      .map((credit) => ({
        creditName: credit.credit_name,
        role: credit.role,
        position: credit.position,
        isSelf: credit.user_id === row.owner_id,
      })),
  }));
}

export async function confirmSourceAssetCredits(input: {
  assetId: string;
  requestId: string;
  credits: Array<
    | {
        kind: "self";
        role: "creator" | "performer" | "producer" | "engineer" | "other";
      }
    | {
        kind: "external";
        role: "creator" | "performer" | "producer" | "engineer" | "other";
        creditName: string;
      }
  >;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("confirm_source_asset_credits", {
    p_asset_id: input.assetId,
    p_request_id: input.requestId,
    p_credits: input.credits,
  });
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
  const completion = await db.rpc("complete_source_upload", {
    p_asset_id: assetId,
  } as never);
  if (completion.error) return { error: completion.error, kickDelayed: false };
  const { error: kickError } = await db.functions.invoke(
    "verify-source-audio",
    {
      body: { assetId },
      region: FunctionRegion.UsWest2,
      timeout: 5_000,
    },
  );
  return { error: null, kickDelayed: Boolean(kickError) };
}
export async function cancelSourceAsset(assetId: string) {
  const db = await createSupabaseServerClient();
  return db.rpc("cancel_source_upload", { p_asset_id: assetId } as never);
}

export async function getSourceVerificationStatus(
  assetId: string,
): Promise<AssetVerificationStatus> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("get_source_verification_status", {
    p_asset_id: assetId,
  } as never);
  const row = (data as unknown as Record<string, unknown>[] | null)?.[0];
  if (error || !row) throw new Error("verification_status_unavailable");
  return {
    assetStatus: String(
      row.asset_status,
    ) as AssetVerificationStatus["assetStatus"],
    verificationState: String(
      row.verification_state,
    ) as AssetVerificationStatus["verificationState"],
    attemptCount: Number(row.attempt_count),
    nextAttemptAt:
      row.next_attempt_at === null ? null : String(row.next_attempt_at),
    failureCode: row.failure_code === null ? null : String(row.failure_code),
    mediaType: row.media_type === null ? null : String(row.media_type),
    byteSize: row.byte_size === null ? null : Number(row.byte_size),
    durationMs: row.duration_ms === null ? null : Number(row.duration_ms),
    sampleRateHz:
      row.sample_rate_hz === null ? null : Number(row.sample_rate_hz),
    channels: row.channels === null ? null : Number(row.channels),
  };
}

export async function retrySourceAssetVerification(assetId: string) {
  const db = await createSupabaseServerClient();
  const retry = await db.rpc("retry_source_verification", {
    p_asset_id: assetId,
  } as never);
  if (retry.error) return { error: retry.error, kickDelayed: false };
  const { error: kickError } = await db.functions.invoke(
    "verify-source-audio",
    {
      body: { assetId },
      region: FunctionRegion.UsWest2,
      timeout: 5_000,
    },
  );
  return { error: null, kickDelayed: Boolean(kickError) };
}
