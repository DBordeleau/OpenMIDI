import type { WorkspaceManifestV1, WorkspaceTrackV1 } from "./manifest/schema";

export type StudioAssetSource = { assetId: string; url: string };
export type StudioLoadInput = {
  manifest: WorkspaceManifestV1;
  assets: readonly StudioAssetSource[];
};
export type AddAudioAssetInput = {
  asset: StudioAssetSource;
  track: WorkspaceTrackV1;
};
export type TrackPatch = Partial<
  Pick<
    WorkspaceTrackV1,
    | "name"
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
      | "decode_failed"
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
