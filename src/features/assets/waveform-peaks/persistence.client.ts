"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  cancelWaveformPeaks,
  finalizeWaveformPeaks,
  reserveWaveformPeaks,
} from "../actions";
import type {
  GeneratedPeaks,
  LosslessAudioMetadata,
} from "../browser-codec/contract";
import {
  serializeWaveformPeaks,
  WAVEFORM_PEAKS_CONTENT_TYPE,
} from "./contract";

export async function persistGeneratedWaveformPeaks(input: {
  sourceAssetId: string;
  peaks: GeneratedPeaks;
  metadata: LosslessAudioMetadata;
}) {
  const bytes = serializeWaveformPeaks({
    sourceAssetId: input.sourceAssetId,
    channels: input.peaks.channels,
    durationMs: Math.round(input.metadata.durationSeconds * 1_000),
    sampleRateHz: input.metadata.sampleRate,
    binCount: input.peaks.bins,
    values: input.peaks.values,
  });
  const reserved = await reserveWaveformPeaks({
    requestId: crypto.randomUUID(),
    sourceAssetId: input.sourceAssetId,
    byteSize: bytes.byteLength,
  });
  if (!reserved.instruction) throw new Error(reserved.error);
  const instruction = reserved.instruction;
  const db = createSupabaseBrowserClient();
  const { error: uploadError } = await db.storage
    .from(instruction.bucket)
    .upload(instruction.objectPath, bytes, {
      contentType: WAVEFORM_PEAKS_CONTENT_TYPE,
      cacheControl: "3600",
      upsert: false,
    });
  if (!uploadError) {
    const finalized = await finalizeWaveformPeaks(instruction.derivativeId);
    if (!finalized.error) return;
  }

  await db.storage.from(instruction.bucket).remove([instruction.objectPath]);
  await cancelWaveformPeaks(instruction.derivativeId);
  throw new Error(
    uploadError?.message ??
      "The waveform could not be persisted. Audio remains available.",
  );
}
