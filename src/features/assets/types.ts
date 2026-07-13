export type AssetStatus =
  "reserved" | "uploading" | "processing" | "ready" | "failed";

export type OwnedSourceAsset = {
  id: string;
  filename: string;
  status: AssetStatus;
  mediaType: string | null;
  byteSize: number | null;
  durationMs: number | null;
  sampleRateHz: number | null;
  channels: number | null;
  failureCode: string | null;
  createdAt: string;
  creditsConfirmedAt: string | null;
  credits: Array<{
    creditName: string;
    role: "creator" | "performer" | "producer" | "engineer" | "other";
    position: number;
    isSelf: boolean;
  }>;
};

export type UploadInstruction = {
  assetId: string;
  bucket: string;
  objectPath: string;
  expiresAt: string;
  capacityWarning: boolean;
};

export type AssetVerificationState =
  "queued" | "verifying" | "retrying" | "delayed" | "dead" | "ready" | "failed";

export type AssetVerificationStatus = {
  assetStatus: AssetStatus;
  verificationState: AssetVerificationState;
  attemptCount: number;
  nextAttemptAt: string | null;
  failureCode: string | null;
  mediaType: string | null;
  byteSize: number | null;
  durationMs: number | null;
  sampleRateHz: number | null;
  channels: number | null;
};

const failureMessages: Record<string, string> = {
  cancelled: "Upload cancelled.",
  expired: "The upload reservation expired.",
  size_mismatch: "The stored file size did not match the upload.",
  unsupported_format: "The file is not a supported WAV, FLAC, or MP3.",
  unreadable_audio: "We could not read the audio data in this file.",
  duration_exceeded: "The audio must be no longer than 10 minutes.",
  sample_rate_exceeded: "The audio sample rate is outside the supported range.",
  channels_exceeded: "The audio must contain between 1 and 8 channels.",
};

export function sourceVerificationFailureMessage(code: string | null) {
  return code
    ? (failureMessages[code] ?? "We could not verify this upload.")
    : "We could not verify this upload.";
}
