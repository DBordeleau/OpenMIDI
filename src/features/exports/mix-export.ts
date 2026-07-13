export const MIX_EXPORT_MAX_DURATION_SECONDS = 600;
export const MIX_EXPORT_MAX_BYTES = 128 * 1024 * 1024;

export function estimateStereoWavBytes(
  durationSeconds: number,
  sampleRate: number,
) {
  return 44 + Math.ceil(durationSeconds * sampleRate * 2 * 2);
}

export function assertMixExportWithinLimits(
  durationSeconds: number,
  sampleRate: number,
) {
  const estimatedBytes = estimateStereoWavBytes(durationSeconds, sampleRate);
  if (
    durationSeconds > MIX_EXPORT_MAX_DURATION_SECONDS ||
    estimatedBytes > MIX_EXPORT_MAX_BYTES
  )
    throw new Error("mix_export_too_large");
  return estimatedBytes;
}
