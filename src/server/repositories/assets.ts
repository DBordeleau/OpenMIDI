import "server-only";
import { FunctionRegion } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AssetVerificationStatus,
  OwnedSourceAsset,
} from "@/features/assets/types";
import type { Database } from "@/lib/supabase/database.types";
import {
  parseWaveformPeaks,
  sha256Hex,
  WAVEFORM_PEAKS_ALGORITHM_VERSION,
} from "@/features/assets/waveform-peaks/contract";

export async function getSourceAdmissionCapability(): Promise<boolean> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("get_source_admission_capability");
  if (error) throw new Error("source_admission_capability_unavailable");
  const row = (data as unknown as Record<string, unknown>[] | null)?.[0];
  if (typeof row?.source_audio_admission_enabled !== "boolean")
    throw new Error("source_admission_capability_unavailable");
  return row.source_audio_admission_enabled;
}

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

export async function reserveWaveformPeakDerivative(input: {
  requestId: string;
  sourceAssetId: string;
  byteSize: number;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("reserve_waveform_peaks", {
    p_request_id: input.requestId,
    p_source_asset_id: input.sourceAssetId,
    p_expected_byte_size: input.byteSize,
  } as never);
}

export async function finalizeWaveformPeakDerivative(derivativeId: string) {
  const db = await createSupabaseServerClient();
  const { data: derivatives, error: derivativeError } = await db
    .from("waveform_peak_derivatives")
    .select("id,source_asset_id,bucket,object_path,status")
    .eq("id", derivativeId)
    .limit(1);
  const derivative = derivatives?.[0];
  if (derivativeError || !derivative)
    return { error: new Error("waveform_peaks_not_found") };
  if (derivative.status === "ready") return { error: null };

  const { data: object, error: downloadError } = await db.storage
    .from(derivative.bucket)
    .download(derivative.object_path);
  if (downloadError || !object)
    return { error: new Error("waveform_peaks_object_unavailable") };

  let bytes: Uint8Array;
  let payload: ReturnType<typeof parseWaveformPeaks>;
  try {
    bytes = new Uint8Array(await object.arrayBuffer());
    payload = parseWaveformPeaks(bytes);
  } catch {
    return { error: new Error("waveform_peaks_invalid_payload") };
  }
  if (payload.sourceAssetId !== derivative.source_asset_id)
    return { error: new Error("waveform_peaks_source_mismatch") };

  const sha256 = await sha256Hex(bytes);
  const { error } = await db.rpc("finalize_waveform_peaks", {
    p_derivative_id: derivativeId,
    p_byte_size: bytes.byteLength,
    p_sha256: sha256,
    p_format_version: payload.formatVersion,
    p_algorithm_version: WAVEFORM_PEAKS_ALGORITHM_VERSION,
    p_channels: payload.channels,
    p_duration_ms: payload.durationMs,
    p_sample_rate_hz: payload.sampleRateHz,
    p_bin_count: payload.binCount,
  } as never);
  return { error };
}

export async function cancelWaveformPeakDerivative(derivativeId: string) {
  const db = await createSupabaseServerClient();
  return db.rpc("cancel_waveform_peaks", {
    p_derivative_id: derivativeId,
  } as never);
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
