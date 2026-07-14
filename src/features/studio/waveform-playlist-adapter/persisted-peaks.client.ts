"use client";

import type { WaveformDataObject } from "@waveform-playlist/core";
import {
  parseWaveformPeaks,
  sha256Hex,
  type WaveformPeaksPayload,
} from "@/features/assets/waveform-peaks/contract";
import type { SignedAudioSource } from "../source-contract";

export async function loadPersistedPeaks(input: {
  sources: readonly SignedAudioSource[];
  signal: AbortSignal;
  onWaveform: (assetId: string, waveform: WaveformDataObject) => void;
}) {
  await Promise.all(
    input.sources.map(async (source) => {
      if (!source.peaks || input.signal.aborted) return;
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
          payload.formatVersion !== source.peaks.formatVersion ||
          payload.algorithmVersion !== source.peaks.algorithmVersion ||
          payload.channels !== source.channels ||
          payload.durationMs !== source.durationMs ||
          payload.sampleRateHz !== source.sampleRateHz ||
          payload.binCount !== source.peaks.binCount
        )
          return;
        input.onWaveform(source.assetId, createWaveformData(payload));
      } catch {
        // Persisted peaks are disposable hints; source decoding remains the fallback.
      }
    }),
  );
}

export function createWaveformData(
  payload: WaveformPeaksPayload,
): WaveformDataObject {
  const sourceSamples = Math.max(
    1,
    Math.round((payload.durationMs / 1_000) * payload.sampleRateHz),
  );
  const minimums = Array.from(
    { length: payload.channels },
    () => new Array<number>(payload.binCount),
  );
  const maximums = Array.from(
    { length: payload.channels },
    () => new Array<number>(payload.binCount),
  );
  for (let channel = 0; channel < payload.channels; channel += 1) {
    for (let bin = 0; bin < payload.binCount; bin += 1) {
      const offset = (channel * payload.binCount + bin) * 2;
      minimums[channel]![bin] = payload.values[offset]!;
      maximums[channel]![bin] = payload.values[offset + 1]!;
    }
  }
  return buildWaveformData({
    sampleRate: payload.sampleRateHz,
    sourceSamples,
    scale: Math.max(1, Math.ceil(sourceSamples / payload.binCount)),
    minimums,
    maximums,
  });
}

function buildWaveformData(input: {
  sampleRate: number;
  sourceSamples: number;
  scale: number;
  minimums: number[][];
  maximums: number[][];
}): WaveformDataObject {
  const length = input.minimums[0]?.length ?? 0;
  const object: WaveformDataObject = {
    sample_rate: input.sampleRate,
    scale: input.scale,
    length,
    bits: 16,
    duration: input.sourceSamples / input.sampleRate,
    channels: input.minimums.length,
    channel: (index) => {
      if (index < 0 || index >= input.minimums.length)
        throw new RangeError("Waveform channel is out of range.");
      return {
        min_array: () => [...input.minimums[index]!],
        max_array: () => [...input.maximums[index]!],
      };
    },
    resample: (options) => {
      const requestedScale =
        "scale" in options
          ? Math.max(1, Math.round(options.scale))
          : Math.max(1, Math.ceil(input.sourceSamples / options.width));
      if (requestedScale <= input.scale) return object;
      const factor = Math.max(1, Math.ceil(requestedScale / input.scale));
      const targetLength = Math.ceil(length / factor);
      const minimums = input.minimums.map((channel) =>
        Array.from({ length: targetLength }, (_, target) =>
          Math.min(...channel.slice(target * factor, (target + 1) * factor)),
        ),
      );
      const maximums = input.maximums.map((channel) =>
        Array.from({ length: targetLength }, (_, target) =>
          Math.max(...channel.slice(target * factor, (target + 1) * factor)),
        ),
      );
      return buildWaveformData({
        ...input,
        scale: input.scale * factor,
        minimums,
        maximums,
      });
    },
    slice: (options) => {
      const start =
        "startIndex" in options
          ? options.startIndex
          : Math.floor((options.startTime * input.sampleRate) / input.scale);
      const end =
        "endIndex" in options
          ? options.endIndex
          : Math.ceil((options.endTime * input.sampleRate) / input.scale);
      const boundedStart = Math.max(0, Math.min(length, start));
      const boundedEnd = Math.max(boundedStart, Math.min(length, end));
      return buildWaveformData({
        ...input,
        sourceSamples: (boundedEnd - boundedStart) * input.scale,
        minimums: input.minimums.map((channel) =>
          channel.slice(boundedStart, boundedEnd),
        ),
        maximums: input.maximums.map((channel) =>
          channel.slice(boundedStart, boundedEnd),
        ),
      });
    },
  };
  return object;
}
