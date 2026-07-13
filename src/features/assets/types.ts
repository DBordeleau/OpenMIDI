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
};

export type UploadInstruction = {
  assetId: string;
  bucket: string;
  objectPath: string;
  expiresAt: string;
  capacityWarning: boolean;
};
