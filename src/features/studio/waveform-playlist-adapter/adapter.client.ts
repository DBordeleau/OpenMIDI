"use client";

import type { ClipTrack } from "@waveform-playlist/core";
import {
  parseWorkspaceManifest,
  type WorkspaceManifestV1,
} from "../manifest/schema";
import type { StudioAdapter } from "../studio-adapter";
import {
  StudioAdapterError,
  type AddAudioAssetInput,
  type StudioAdapterStatus,
  type StudioLoadInput,
  type TrackPatch,
  type TrackRef,
} from "../studio-adapter.types";
import { editorTracksToManifest, manifestTrackToClipTrack } from "./mapping";

type RuntimeBridge = {
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  renderMix(tracks: ClipTrack[]): Promise<Blob>;
};

export class WaveformPlaylistStudioAdapter implements StudioAdapter {
  private manifest: WorkspaceManifestV1 | null = null;
  private tracks: ClipTrack[] = [];
  private decodeContext: AudioContext | null = null;
  private runtime: RuntimeBridge | null = null;
  private status: StudioAdapterStatus = "idle";
  private disposed = false;
  private readonly listeners = new Set<() => void>();
  private snapshot = {
    status: this.status,
    tracks: this.tracks,
    manifest: this.manifest,
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  attachRuntime(runtime: RuntimeBridge | null) {
    this.runtime = runtime;
  }

  acceptEditorTracks(tracks: ClipTrack[]) {
    this.assertReady();
    if (!this.manifest) return;
    this.tracks = tracks;
    this.manifest = parseWorkspaceManifest(
      editorTracksToManifest(this.manifest, tracks),
    );
    this.emit();
  }

  async load({ manifest, assets }: StudioLoadInput) {
    this.assertLive();
    if (!("AudioContext" in window) || !("OfflineAudioContext" in window)) {
      throw new StudioAdapterError(
        "unsupported",
        "This browser does not support the Web Audio APIs required by the studio.",
      );
    }
    this.setStatus("loading");
    try {
      this.manifest = parseWorkspaceManifest(manifest);
      this.decodeContext ??= new AudioContext();
      const buffers = new Map<string, AudioBuffer>();
      await Promise.all(
        this.manifest.tracks.map(async (track) => {
          const asset = assets.find(({ assetId }) => assetId === track.assetId);
          if (!asset)
            throw new StudioAdapterError(
              "missing_asset",
              `No source was supplied for asset ${track.assetId}.`,
            );
          const response = await fetch(asset.url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          buffers.set(
            track.assetId,
            await this.decodeContext!.decodeAudioData(
              await response.arrayBuffer(),
            ),
          );
        }),
      );
      this.tracks = this.manifest.tracks.map((track) =>
        manifestTrackToClipTrack(track, buffers.get(track.assetId)!),
      );
      this.setStatus("ready");
    } catch (error) {
      this.setStatus("error");
      if (error instanceof StudioAdapterError) throw error;
      throw new StudioAdapterError(
        "decode_failed",
        "The fixture audio could not be fetched and decoded.",
        { cause: error },
      );
    }
  }

  async play() {
    this.assertReady();
    if (!this.runtime)
      throw new StudioAdapterError(
        "invalid_state",
        "The playlist controls are not ready yet.",
      );
    await this.runtime.play();
    this.setStatus("playing");
  }

  pause() {
    this.assertReady();
    this.runtime?.pause();
    this.setStatus("paused");
  }

  seek(seconds: number) {
    this.assertReady();
    if (!Number.isFinite(seconds) || seconds < 0)
      throw new StudioAdapterError(
        "invalid_state",
        "Seek time must be non-negative.",
      );
    this.runtime?.seek(seconds);
  }

  async addAudioAsset({ asset, track }: AddAudioAssetInput): Promise<TrackRef> {
    this.assertReady();
    if (!this.decodeContext || !this.manifest)
      throw new StudioAdapterError(
        "invalid_state",
        "Load the studio before adding audio.",
      );
    try {
      const response = await fetch(asset.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = await this.decodeContext.decodeAudioData(
        await response.arrayBuffer(),
      );
      const manifest = parseWorkspaceManifest({
        ...this.manifest,
        tracks: [...this.manifest.tracks, track],
      });
      this.manifest = manifest;
      this.tracks = [...this.tracks, manifestTrackToClipTrack(track, buffer)];
      this.emit();
      return { trackId: track.trackId, assetId: track.assetId };
    } catch (error) {
      throw new StudioAdapterError(
        "decode_failed",
        `Could not add asset ${asset.assetId}.`,
        { cause: error },
      );
    }
  }

  updateTrack(id: string, patch: TrackPatch) {
    this.assertReady();
    if (!this.manifest) return;
    const index = this.manifest.tracks.findIndex(
      ({ trackId }) => trackId === id,
    );
    if (index < 0)
      throw new StudioAdapterError("missing_asset", `Unknown track ${id}.`);
    const tracks = this.manifest.tracks.map((track, trackIndex) =>
      trackIndex === index ? { ...track, ...patch } : track,
    );
    this.manifest = parseWorkspaceManifest({ ...this.manifest, tracks });
    const editor = this.tracks[index];
    const buffer = editor?.clips[0]?.audioBuffer;
    if (!buffer)
      throw new StudioAdapterError(
        "invalid_state",
        `Track ${id} is not decoded.`,
      );
    this.tracks = this.manifest.tracks.map((track) => {
      const existing = this.tracks.find(
        ({ id: trackId }) => trackId === track.trackId,
      );
      return track.trackId === id
        ? manifestTrackToClipTrack(track, buffer)
        : existing!;
    });
    this.emit();
  }

  exportManifest() {
    this.assertReady();
    if (!this.manifest)
      throw new StudioAdapterError("invalid_state", "No manifest is loaded.");
    return parseWorkspaceManifest(
      editorTracksToManifest(this.manifest, this.tracks),
    );
  }

  async renderMix() {
    this.assertReady();
    if (!this.runtime)
      throw new StudioAdapterError(
        "export_failed",
        "The export engine is not ready.",
      );
    const blob = await this.runtime.renderMix(this.tracks);
    if (blob.size <= 44 || blob.type !== "audio/wav")
      throw new StudioAdapterError(
        "export_failed",
        "The WAV export was empty or invalid.",
      );
    return blob;
  }

  async dispose() {
    if (this.disposed) return;
    this.runtime?.pause();
    this.runtime = null;
    await this.decodeContext?.close();
    this.decodeContext = null;
    this.tracks = [];
    this.manifest = null;
    this.disposed = true;
    this.setStatus("disposed");
    this.listeners.clear();
  }

  private assertLive() {
    if (this.disposed)
      throw new StudioAdapterError(
        "invalid_state",
        "This studio adapter has been disposed.",
      );
  }
  private assertReady() {
    this.assertLive();
    if (!this.manifest || !["ready", "playing", "paused"].includes(this.status))
      throw new StudioAdapterError(
        "invalid_state",
        "Open the studio and wait for it to become ready.",
      );
  }
  private setStatus(status: StudioAdapterStatus) {
    this.status = status;
    this.emit();
  }
  private emit() {
    this.snapshot = {
      status: this.status,
      tracks: this.tracks,
      manifest: this.manifest,
    };
    for (const listener of this.listeners) listener();
  }
}
