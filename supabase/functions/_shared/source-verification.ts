export const SOURCE_AUDIO_VERIFICATION_VERSION = "source-audio-v2";
export const MAX_SOURCE_AUDIO_BYTES = 45 * 1024 * 1024;
export const MAX_SOURCE_AUDIO_DURATION_MS = 10 * 60 * 1000;

export type TrustedMediaType = "audio/wav" | "audio/flac" | "audio/mpeg";

export class PermanentVerificationError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = "PermanentVerificationError";
  }
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

export function detectSourceAudioSignature(
  bytes: Uint8Array,
): TrustedMediaType | null {
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WAVE"
  ) {
    return "audio/wav";
  }
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === "fLaC") {
    return "audio/flac";
  }
  if (
    (bytes.length >= 3 && ascii(bytes, 0, 3) === "ID3") ||
    (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  ) {
    return "audio/mpeg";
  }
  return null;
}

export function validateSourceAudioMetadata(input: {
  signatureMediaType: TrustedMediaType | null;
  container?: string;
  durationSeconds?: number;
  sampleRateHz?: number;
  channels?: number;
}) {
  const container = input.container?.toLowerCase() ?? "";
  const containerMediaType = container.includes("flac")
    ? "audio/flac"
    : container.includes("mpeg") || container.includes("mp3")
      ? "audio/mpeg"
      : container.includes("wave") || container.includes("wav")
        ? "audio/wav"
        : null;

  if (
    input.signatureMediaType === null ||
    containerMediaType === null ||
    input.signatureMediaType !== containerMediaType
  ) {
    throw new PermanentVerificationError("unsupported_format");
  }

  const durationMs = Math.round((input.durationSeconds ?? 0) * 1000);
  const sampleRateHz = input.sampleRateHz ?? 0;
  const channels = input.channels ?? 0;
  if (durationMs < 1 || durationMs > MAX_SOURCE_AUDIO_DURATION_MS) {
    throw new PermanentVerificationError("duration_exceeded");
  }
  if (sampleRateHz < 8000 || sampleRateHz > 192000) {
    throw new PermanentVerificationError("sample_rate_exceeded");
  }
  if (channels < 1 || channels > 8) {
    throw new PermanentVerificationError("channels_exceeded");
  }

  return {
    mediaType: input.signatureMediaType,
    durationMs,
    sampleRateHz,
    channels,
  };
}

export async function sha256Hex(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
