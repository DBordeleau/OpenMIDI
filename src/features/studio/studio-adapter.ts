import type { WorkspaceManifestV1 } from "./manifest/schema";
import type {
  AddAudioAssetInput,
  StudioLoadInput,
  TrackPatch,
  TrackRef,
} from "./studio-adapter.types";

export interface StudioAdapter {
  load(input: StudioLoadInput): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  addAudioAsset(input: AddAudioAssetInput): Promise<TrackRef>;
  updateTrack(id: string, patch: TrackPatch): void;
  exportManifest(): WorkspaceManifestV1;
  renderMix(): Promise<Blob>;
  dispose(): Promise<void>;
}
