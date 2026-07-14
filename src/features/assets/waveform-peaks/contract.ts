export const WAVEFORM_PEAKS_CONTENT_TYPE =
  "application/vnd.jam-session.waveform-peaks";
export const WAVEFORM_PEAKS_FORMAT_VERSION = 1;
export const WAVEFORM_PEAKS_ALGORITHM_VERSION = "pcm-minmax-v1";
export const WAVEFORM_PEAKS_BIN_COUNT = 2_048;
export const WAVEFORM_PEAKS_MAX_BYTES = 512 * 1_024;

const MAGIC = new Uint8Array([0x4a, 0x53, 0x50, 0x4b]); // JSPK
const HEADER_BYTES = 40;
const ALGORITHM_ID = 1;

export type WaveformPeaksPayload = {
  sourceAssetId: string;
  formatVersion: typeof WAVEFORM_PEAKS_FORMAT_VERSION;
  algorithmVersion: typeof WAVEFORM_PEAKS_ALGORITHM_VERSION;
  channels: number;
  durationMs: number;
  sampleRateHz: number;
  binCount: typeof WAVEFORM_PEAKS_BIN_COUNT;
  values: Int16Array;
};

export function serializeWaveformPeaks(input: {
  sourceAssetId: string;
  channels: number;
  durationMs: number;
  sampleRateHz: number;
  binCount: number;
  values: Float32Array;
}) {
  validateMetadata(input);
  const expectedValues = input.channels * input.binCount * 2;
  if (input.values.length !== expectedValues)
    throw new Error("The waveform summary has an unexpected value count.");

  const bytes = new Uint8Array(HEADER_BYTES + expectedValues * 2);
  bytes.set(MAGIC, 0);
  const view = new DataView(bytes.buffer);
  view.setUint16(4, WAVEFORM_PEAKS_FORMAT_VERSION, true);
  view.setUint16(6, ALGORITHM_ID, true);
  bytes.set(uuidToBytes(input.sourceAssetId), 8);
  view.setUint8(24, input.channels);
  view.setUint8(25, 1); // one bounded resolution level
  view.setUint16(26, 0, true);
  view.setUint32(28, input.sampleRateHz, true);
  view.setUint32(32, input.durationMs, true);
  view.setUint32(36, input.binCount, true);

  for (let index = 0; index < input.values.length; index += 2) {
    const minimum = input.values[index];
    const maximum = input.values[index + 1];
    if (
      minimum === undefined ||
      maximum === undefined ||
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum) ||
      minimum < -1 ||
      maximum > 1 ||
      minimum > maximum
    )
      throw new Error("The waveform summary contains invalid peak bounds.");
    view.setInt16(HEADER_BYTES + index * 2, Math.round(minimum * 32_767), true);
    view.setInt16(
      HEADER_BYTES + (index + 1) * 2,
      Math.round(maximum * 32_767),
      true,
    );
  }
  if (bytes.byteLength > WAVEFORM_PEAKS_MAX_BYTES)
    throw new Error("The waveform summary exceeds the persisted peak limit.");
  return bytes;
}

export function parseWaveformPeaks(input: ArrayBuffer | Uint8Array) {
  const bytes =
    input instanceof Uint8Array
      ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
      : new Uint8Array(input);
  if (
    bytes.byteLength < HEADER_BYTES ||
    MAGIC.some((value, index) => bytes[index] !== value)
  )
    throw new Error("The waveform summary has an invalid signature.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const formatVersion = view.getUint16(4, true);
  const algorithmId = view.getUint16(6, true);
  const channels = view.getUint8(24);
  const resolutionCount = view.getUint8(25);
  const reserved = view.getUint16(26, true);
  const sampleRateHz = view.getUint32(28, true);
  const durationMs = view.getUint32(32, true);
  const binCount = view.getUint32(36, true);
  if (
    formatVersion !== WAVEFORM_PEAKS_FORMAT_VERSION ||
    algorithmId !== ALGORITHM_ID ||
    resolutionCount !== 1 ||
    reserved !== 0
  )
    throw new Error("The waveform summary version is not supported.");
  validateMetadata({ channels, durationMs, sampleRateHz, binCount });
  const valueCount = channels * binCount * 2;
  if (
    bytes.byteLength !== HEADER_BYTES + valueCount * 2 ||
    bytes.byteLength > WAVEFORM_PEAKS_MAX_BYTES
  )
    throw new Error("The waveform summary length is invalid.");

  const values = new Int16Array(valueCount);
  for (let index = 0; index < valueCount; index += 2) {
    const minimum = view.getInt16(HEADER_BYTES + index * 2, true);
    const maximum = view.getInt16(HEADER_BYTES + (index + 1) * 2, true);
    if (minimum > maximum)
      throw new Error("The waveform summary contains invalid peak bounds.");
    values[index] = minimum;
    values[index + 1] = maximum;
  }

  return {
    sourceAssetId: bytesToUuid(bytes.subarray(8, 24)),
    formatVersion: WAVEFORM_PEAKS_FORMAT_VERSION,
    algorithmVersion: WAVEFORM_PEAKS_ALGORITHM_VERSION,
    channels,
    durationMs,
    sampleRateHz,
    binCount: WAVEFORM_PEAKS_BIN_COUNT,
    values,
  } satisfies WaveformPeaksPayload;
}

export async function sha256Hex(input: ArrayBuffer | Uint8Array) {
  const bytes =
    input instanceof Uint8Array
      ? Uint8Array.from(input)
      : new Uint8Array(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function validateMetadata(input: {
  channels: number;
  durationMs: number;
  sampleRateHz: number;
  binCount: number;
}) {
  if (
    !Number.isInteger(input.channels) ||
    input.channels < 1 ||
    input.channels > 8 ||
    !Number.isInteger(input.durationMs) ||
    input.durationMs < 1 ||
    input.durationMs > 600_000 ||
    !Number.isInteger(input.sampleRateHz) ||
    input.sampleRateHz < 8_000 ||
    input.sampleRateHz > 192_000 ||
    input.binCount !== WAVEFORM_PEAKS_BIN_COUNT
  )
    throw new Error(
      "The waveform summary metadata is outside accepted limits.",
    );
}

function uuidToBytes(value: string) {
  const compact = value.replaceAll("-", "");
  if (!/^[0-9a-f]{32}$/i.test(compact))
    throw new Error("The waveform summary source ID is invalid.");
  return Uint8Array.from(
    compact.match(/.{2}/g)!.map((part) => Number.parseInt(part, 16)),
  );
}

function bytesToUuid(bytes: Uint8Array) {
  const value = [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
