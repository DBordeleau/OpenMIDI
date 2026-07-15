"use client";

import {
  parseWaveformPeaks,
  sha256Hex,
} from "@/features/assets/waveform-peaks/contract";
import type { SignedAudioSource } from "../source-contract";

export type AudioLaneSummary = {
  status: "loading" | "persisted" | "ready" | "failed";
  peaks: readonly number[];
};

export async function loadAudioLaneSummaries(input: {
  sources: readonly SignedAudioSource[];
  signal: AbortSignal;
  onSummary: (assetId: string, summary: AudioLaneSummary) => void;
}) {
  await Promise.all(
    input.sources.map(async (source) => {
      if (!source.peaks) return;
      try {
        const response = await fetch(source.peaks.signedUrl, {
          cache: "default",
          signal: input.signal,
        });
        if (!response.ok) return;
        const bytes = new Uint8Array(await response.arrayBuffer());
        if ((await sha256Hex(bytes)) !== source.peaks.sha256) return;
        const payload = parseWaveformPeaks(bytes);
        if (
          payload.sourceAssetId !== source.assetId ||
          payload.durationMs !== source.durationMs ||
          payload.sampleRateHz !== source.sampleRateHz
        )
          return;
        input.onSummary(source.assetId, {
          status: "persisted",
          peaks: downsamplePeaks(
            payload.values,
            payload.channels,
            payload.binCount,
          ),
        });
      } catch {
        // Persisted peaks are a disposable visual hint. Decoding remains authoritative.
      }
    }),
  );
}

export function summarizeAudioBuffer(buffer: AudioBuffer, bins = 160) {
  const peaks = new Array<number>(bins).fill(0);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const samples = buffer.getChannelData(channel);
    for (let bin = 0; bin < bins; bin += 1) {
      const start = Math.floor((bin * samples.length) / bins);
      const end = Math.max(
        start + 1,
        Math.floor(((bin + 1) * samples.length) / bins),
      );
      for (let index = start; index < end; index += 1)
        peaks[bin] = Math.max(peaks[bin]!, Math.abs(samples[index] ?? 0));
    }
  }
  return peaks;
}

function downsamplePeaks(
  values: Int16Array,
  channels: number,
  binCount: number,
  bins = 160,
) {
  return Array.from({ length: bins }, (_, target) => {
    const start = Math.floor((target * binCount) / bins);
    const end = Math.max(
      start + 1,
      Math.floor(((target + 1) * binCount) / bins),
    );
    let peak = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      for (let bin = start; bin < end; bin += 1) {
        const offset = (channel * binCount + bin) * 2;
        peak = Math.max(
          peak,
          Math.abs(values[offset] ?? 0) / 32_767,
          Math.abs(values[offset + 1] ?? 0) / 32_767,
        );
      }
    }
    return peak;
  });
}
