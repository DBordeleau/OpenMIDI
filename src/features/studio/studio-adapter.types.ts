import type { WorkspaceManifestV1, WorkspaceTrackV1 } from "./manifest/schema";

import type { SignedAudioSource } from "./source-contract";
export type StudioAssetSource = { assetId: string; url: string };
export type StudioLoadInput = {
  manifest: WorkspaceManifestV1;
  sources: readonly SignedAudioSource[];
  refreshSources: () => Promise<readonly SignedAudioSource[]>;
  signal: AbortSignal;
  onProgress?: (loaded: number, total: number) => void;
};
export type AddAudioAssetInput = {
  asset: StudioAssetSource;
  track: WorkspaceTrackV1;
};
export type TrackPatch = Partial<
  Pick<
    WorkspaceTrackV1,
    | "name"
    | "instrumentId"
    | "positionMs"
    | "trimStartMs"
    | "durationMs"
    | "gainDb"
    | "pan"
    | "muted"
    | "soloed"
    | "sortOrder"
  >
>;
export type TrackRef = Pick<WorkspaceTrackV1, "trackId" | "assetId">;

export type StudioAdapterStatus =
  "idle" | "loading" | "ready" | "playing" | "paused" | "disposed" | "error";

export class StudioAdapterError extends Error {
  constructor(
    readonly code:
      | "unsupported"
      | "unauthorized_source"
      | "expired_source"
      | "missing_source"
      | "fetch_failed"
      | "decode_failed"
      | "audio_suspended"
      | "cancelled"
      | "invalid_state"
      | "missing_asset"
      | "export_failed",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "StudioAdapterError";
  }
}
