export const LOSSLESS_CONVERSION_VERSION = "mediabunny-flac-v1";
export const PEAKS_VERSION = 1;
export const PEAK_BIN_COUNT = 2_048;
export const MAX_SOURCE_DURATION_SECONDS = 600;
export const MIN_SOURCE_SAMPLE_RATE = 8_000;
export const MAX_SOURCE_SAMPLE_RATE = 192_000;
export const MAX_SOURCE_CHANNELS = 8;
const MAX_SOURCE_BYTES = 45 * 1024 * 1024;

export type LosslessAudioMetadata = {
  durationSeconds: number;
  channels: number;
  sampleRate: number;
};

export type GeneratedPeaks = {
  version: typeof PEAKS_VERSION;
  bins: number;
  channels: number;
  values: Float32Array;
};

export type LosslessOptimizationResult = {
  file: File;
  metadata: LosslessAudioMetadata;
  peaks: GeneratedPeaks;
  conversionVersion: typeof LOSSLESS_CONVERSION_VERSION;
};

export type WorkerDoneMessage = {
  type: "done";
  bytes: ArrayBuffer;
  metadata: LosslessAudioMetadata;
  sourceMetadata: LosslessAudioMetadata;
  peaks: ArrayBuffer;
  peakBins: number;
  conversionMilliseconds: number;
};

export type WorkerResponse =
  | { type: "progress"; progress: number }
  | { type: "cancelled" }
  | { type: "error"; code: string; message: string }
  | WorkerDoneMessage;

export function validateLosslessResult(message: WorkerDoneMessage) {
  const bytes = new Uint8Array(message.bytes);
  if (
    bytes.byteLength < 4 ||
    String.fromCharCode(...bytes.subarray(0, 4)) !== "fLaC"
  )
    throw new Error("The optimized file did not have a valid FLAC signature.");
  if (bytes.byteLength > MAX_SOURCE_BYTES)
    throw new Error("The optimized FLAC exceeds the 45 MiB source limit.");

  validateMetadata(message.sourceMetadata, "selected WAV");
  validateMetadata(message.metadata, "optimized FLAC");
  const tolerance = Math.max(0.002, 2 / message.sourceMetadata.sampleRate);
  if (
    message.metadata.channels !== message.sourceMetadata.channels ||
    message.metadata.sampleRate !== message.sourceMetadata.sampleRate ||
    Math.abs(
      message.metadata.durationSeconds - message.sourceMetadata.durationSeconds,
    ) > tolerance
  )
    throw new Error(
      "The optimized FLAC metadata did not match the selected WAV.",
    );

  const values = new Float32Array(message.peaks);
  const expectedValues = message.peakBins * message.sourceMetadata.channels * 2;
  if (
    message.peakBins !== PEAK_BIN_COUNT ||
    values.length !== expectedValues ||
    values.some((value) => !Number.isFinite(value) || value < -1 || value > 1)
  )
    throw new Error("The generated waveform summary was invalid.");

  return values;
}

function validateMetadata(metadata: LosslessAudioMetadata, label: string) {
  if (
    !Number.isFinite(metadata.durationSeconds) ||
    metadata.durationSeconds <= 0 ||
    metadata.durationSeconds > MAX_SOURCE_DURATION_SECONDS ||
    !Number.isInteger(metadata.channels) ||
    metadata.channels < 1 ||
    metadata.channels > MAX_SOURCE_CHANNELS ||
    !Number.isInteger(metadata.sampleRate) ||
    metadata.sampleRate < MIN_SOURCE_SAMPLE_RATE ||
    metadata.sampleRate > MAX_SOURCE_SAMPLE_RATE
  )
    throw new Error(`The ${label} metadata is outside the accepted limits.`);
}

export function optimizedFilename(filename: string) {
  const base = filename.replace(/\.wav$/i, "").trim() || "source";
  return `${base}.flac`;
}
