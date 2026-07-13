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
import { loadSources } from "./source-loader.client";

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

  async load({
    manifest,
    sources,
    refreshSources,
    signal,
    onProgress,
  }: StudioLoadInput) {
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
      const buffers = await loadSources({
        assetIds: this.manifest.tracks.map((track) => track.assetId),
        sources,
        refresh: refreshSources,
        signal,
        onProgress,
        decode: (bytes) => this.decodeContext!.decodeAudioData(bytes),
      });
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
    try {
      await this.runtime.play();
    } catch (error) {
      throw new StudioAdapterError(
        "audio_suspended",
        "Audio is paused by the browser. Enable audio and try again.",
        { cause: error },
      );
    }
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

  removeTrack(id: string) {
    this.assertReady();
    if (!this.manifest) return;
    if (this.manifest.tracks.length === 1)
      throw new StudioAdapterError(
        "invalid_state",
        "A workspace must keep at least one track.",
      );
    if (!this.manifest.tracks.some((track) => track.trackId === id))
      throw new StudioAdapterError("missing_asset", "Unknown track.");
    const tracks = this.manifest.tracks
      .filter((track) => track.trackId !== id)
      .map((track, sortOrder) => ({ ...track, sortOrder }));
    this.manifest = parseWorkspaceManifest({ ...this.manifest, tracks });
    this.tracks = this.tracks.filter((track) => track.id !== id);
    this.emit();
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

  reorderTracks(trackIds: readonly string[]) {
    this.assertReady();
    if (
      !this.manifest ||
      trackIds.length !== this.manifest.tracks.length ||
      new Set(trackIds).size !== trackIds.length ||
      trackIds.some(
        (id) => !this.manifest!.tracks.some((track) => track.trackId === id),
      )
    )
      throw new StudioAdapterError(
        "invalid_state",
        "Track order does not match the workspace.",
      );
    const byId = new Map(
      this.manifest.tracks.map((track) => [track.trackId, track]),
    );
    const editorById = new Map(this.tracks.map((track) => [track.id, track]));
    this.manifest = parseWorkspaceManifest({
      ...this.manifest,
      tracks: trackIds.map((id, sortOrder) => ({
        ...byId.get(id)!,
        sortOrder,
      })),
    });
    this.tracks = trackIds.map((id) => editorById.get(id)!);
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
