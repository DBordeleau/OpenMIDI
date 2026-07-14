import { afterEach, describe, expect, it, vi } from "vitest";
import {
  serializeWaveformPeaks,
  sha256Hex,
  WAVEFORM_PEAKS_BIN_COUNT,
} from "@/features/assets/waveform-peaks/contract";
import type { SignedAudioSource } from "../source-contract";
import { loadPersistedPeaks } from "./persisted-peaks.client";

const assetId = "71000000-0000-4000-8000-000000000001";

async function fixture(): Promise<{
  bytes: Uint8Array;
  source: SignedAudioSource;
}> {
  const values = new Float32Array(WAVEFORM_PEAKS_BIN_COUNT * 2);
  for (let index = 0; index < values.length; index += 2) {
    values[index] = -0.25;
    values[index + 1] = 0.5;
  }
  const bytes = serializeWaveformPeaks({
    sourceAssetId: assetId,
    channels: 1,
    durationMs: 2_000,
    sampleRateHz: 44_100,
    binCount: WAVEFORM_PEAKS_BIN_COUNT,
    values,
  });
  return {
    bytes,
    source: {
      assetId,
      signedUrl: "https://example.test/source",
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      mediaType: "audio/flac",
      durationMs: 2_000,
      sampleRateHz: 44_100,
      channels: 1,
      peaks: {
        signedUrl: "https://example.test/peaks",
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        sha256: await sha256Hex(bytes),
        formatVersion: 1,
        algorithmVersion: "pcm-minmax-v1",
        channels: 1,
        durationMs: 2_000,
        sampleRateHz: 44_100,
        binCount: WAVEFORM_PEAKS_BIN_COUNT,
      },
    },
  };
}

describe("persisted waveform peak loading", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("hydrates waveform data without decoding source audio", async () => {
    const { bytes, source } = await fixture();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(bytes.buffer as ArrayBuffer)),
    );
    const onWaveform = vi.fn();
    await loadPersistedPeaks({
      sources: [source],
      signal: new AbortController().signal,
      onWaveform,
    });
    expect(onWaveform).toHaveBeenCalledTimes(1);
    const waveform = onWaveform.mock.calls[0]![1];
    expect(waveform.channel(0).min_array()[0]).toBe(-8_192);
    expect(waveform.channel(0).max_array()[0]).toBe(16_384);
  });

  it("ignores corrupt, stale, or descriptor-mismatched hints", async () => {
    const { bytes, source } = await fixture();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(bytes.buffer as ArrayBuffer)),
    );
    const onWaveform = vi.fn();
    await loadPersistedPeaks({
      sources: [
        {
          ...source,
          peaks: { ...source.peaks!, sha256: "0".repeat(64) },
        },
      ],
      signal: new AbortController().signal,
      onWaveform,
    });
    expect(onWaveform).not.toHaveBeenCalled();
  });
});
