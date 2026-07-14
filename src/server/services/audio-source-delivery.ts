import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const SIGNED_URL_SECONDS = 600;

type DeliverableSource = {
  id: string;
  bucket: string;
  object_path: string;
  media_type: string | null;
  duration_ms: number | null;
  sample_rate_hz: number | null;
  channels: number | null;
};

export async function signAudioSourceDescriptors(
  db: SupabaseClient<Database>,
  sources: readonly DeliverableSource[],
) {
  const { data: signedSources, error: sourceSignError } = await db.storage
    .from("source-audio")
    .createSignedUrls(
      sources.map((source) => source.object_path),
      SIGNED_URL_SECONDS,
    );
  if (
    sourceSignError ||
    signedSources.length !== sources.length ||
    signedSources.some((item) => item.error || !item.signedUrl)
  )
    return { error: "audio_access_unavailable" as const };

  const { data: peakRows, error: peakError } = await db
    .from("waveform_peak_derivatives")
    .select(
      "source_asset_id,bucket,object_path,sha256,format_version,algorithm_version,channels,duration_ms,sample_rate_hz,bin_count",
    )
    .in(
      "source_asset_id",
      sources.map((source) => source.id),
    )
    .eq("status", "ready");
  const validPeaks = (peakError ? [] : peakRows).filter((peak) => {
    const source = sources.find((item) => item.id === peak.source_asset_id);
    return (
      source &&
      peak.bucket === "derived-assets" &&
      peak.sha256 !== null &&
      peak.format_version === 1 &&
      peak.algorithm_version === "pcm-minmax-v1" &&
      peak.channels === source.channels &&
      peak.duration_ms === source.duration_ms &&
      peak.sample_rate_hz === source.sample_rate_hz &&
      peak.bin_count === 2_048
    );
  });
  const { data: signedPeaks, error: peakSignError } = validPeaks.length
    ? await db.storage.from("derived-assets").createSignedUrls(
        validPeaks.map((peak) => peak.object_path),
        SIGNED_URL_SECONDS,
      )
    : { data: [], error: null };
  const usableSignedPeaks =
    !peakSignError &&
    signedPeaks &&
    signedPeaks.length === validPeaks.length &&
    signedPeaks.every((item) => !item.error && item.signedUrl)
      ? signedPeaks
      : [];

  const expiresAt = new Date(
    Date.now() + SIGNED_URL_SECONDS * 1_000,
  ).toISOString();
  const peaksBySource = new Map(
    (usableSignedPeaks.length === validPeaks.length ? validPeaks : []).map(
      (peak, index) => [
        peak.source_asset_id,
        {
          signedUrl: usableSignedPeaks[index]!.signedUrl,
          expiresAt,
          sha256: peak.sha256!,
          formatVersion: peak.format_version!,
          algorithmVersion: peak.algorithm_version!,
          channels: peak.channels!,
          durationMs: peak.duration_ms!,
          sampleRateHz: peak.sample_rate_hz!,
          binCount: peak.bin_count!,
        },
      ],
    ),
  );
  return {
    sources: sources.map((source, index) => ({
      assetId: source.id,
      signedUrl: signedSources[index]!.signedUrl,
      expiresAt,
      mediaType: source.media_type,
      durationMs: source.duration_ms!,
      sampleRateHz: source.sample_rate_hz!,
      channels: source.channels!,
      peaks: peaksBySource.get(source.id) ?? null,
    })),
  };
}
