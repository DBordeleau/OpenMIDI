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
  type RetryStudioTrackInput,
  type StudioAdapterStatus,
  type StudioLoadInput,
  type StudioTrackLoadState,
  type StudioTrackReadiness,
  type TrackPatch,
  type TrackRef,
} from "../studio-adapter.types";
import { editorTracksToManifest, manifestTrackToClipTrack } from "./mapping";
import { loadSources } from "./source-loader.client";
import { studioSourceBufferRegistry } from "./source-buffer-registry.client";

type RuntimeBridge = {
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  renderMix(tracks: ClipTrack[]): Promise<Blob>;
};

export type StudioAdapterSnapshot = {
  status: StudioAdapterStatus;
  tracks: ClipTrack[];
  manifest: WorkspaceManifestV1 | null;
  trackLoadStates: StudioTrackLoadState[];
  playbackReady: boolean;
};

export class WaveformPlaylistStudioAdapter implements StudioAdapter {
  private manifest: WorkspaceManifestV1 | null = null;
  private tracks: ClipTrack[] = [];
  private trackLoadStates = new Map<string, StudioTrackLoadState>();
  private actorId: string | null = null;
  private decodeContext: AudioContext | null = null;
  private runtime: RuntimeBridge | null = null;
  private status: StudioAdapterStatus = "idle";
  private disposed = false;
  private loadGeneration = 0;
  private readonly listeners = new Set<() => void>();
  private snapshot: StudioAdapterSnapshot = {
    status: this.status,
    tracks: this.tracks,
    manifest: this.manifest,
    trackLoadStates: [],
    playbackReady: false,
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  prepare(manifest: WorkspaceManifestV1, actorId: string) {
    this.assertLive();
    if (this.manifest) return;
    this.actorId = actorId;
    studioSourceBufferRegistry.activateActor(actorId);
    this.manifest = parseWorkspaceManifest(manifest);
    this.tracks = this.manifest.tracks.map((track) =>
      manifestTrackToClipTrack(track),
    );
    this.trackLoadStates = new Map(
      this.manifest.tracks.map((track) => [
        track.trackId,
        {
          trackId: track.trackId,
          assetId: track.assetId,
          status: "queued" as const,
          message: null,
        },
      ]),
    );
    this.status = "loading";
    this.emit();
  }

  attachRuntime(runtime: RuntimeBridge | null) {
    this.runtime = runtime;
  }

  acceptEditorTracks(tracks: ClipTrack[]) {
    this.assertShellReady();
    if (!this.manifest) return;
    this.tracks = tracks;
    this.manifest = parseWorkspaceManifest(
      editorTracksToManifest(this.manifest, tracks),
    );
    this.emit();
  }

  async load({
    manifest,
    actorId,
    sources,
    refreshSources,
    signal,
  }: StudioLoadInput) {
    this.assertLive();
    if (!this.manifest) this.prepare(manifest, actorId);
    if (this.actorId !== actorId)
      throw new StudioAdapterError(
        "invalid_state",
        "The studio actor changed. Reopen the studio.",
      );
    this.assertBrowserAudio();
    this.decodeContext ??= new AudioContext();
    const generation = ++this.loadGeneration;
    await loadSources({
      actorId,
      assetIds: this.manifest!.tracks.map((track) => track.assetId),
      sources,
      refresh: refreshSources,
      signal,
      decode: (bytes) => this.decodeContext!.decodeAudioData(bytes),
      onStatus: (assetId, status, error) =>
        this.acceptSourceStatus(generation, signal, assetId, status, error),
      onBuffer: (assetId, buffer) =>
        this.attachBuffer(generation, signal, assetId, buffer),
    });
    if (signal.aborted || generation !== this.loadGeneration) return;
    this.finishLoadAttempt();
  }

  async retryTrack({
    trackId,
    actorId,
    sources,
    refreshSources,
    signal,
  }: RetryStudioTrackInput) {
    this.assertShellReady();
    const track = this.manifest?.tracks.find(
      (item) => item.trackId === trackId,
    );
    if (!track) throw new StudioAdapterError("missing_asset", "Unknown track.");
    this.setTrackStatus(track.assetId, "queued");
    const generation = this.loadGeneration;
    await loadSources({
      actorId,
      assetIds: [track.assetId],
      sources,
      refresh: refreshSources,
      signal,
      concurrency: 1,
      decode: (bytes) => this.decodeContext!.decodeAudioData(bytes),
      onStatus: (assetId, status, error) =>
        this.acceptSourceStatus(generation, signal, assetId, status, error),
      onBuffer: (assetId, buffer) =>
        this.attachBuffer(generation, signal, assetId, buffer),
    });
    if (signal.aborted || generation !== this.loadGeneration) return;
    this.finishLoadAttempt();
  }

  async play() {
    this.assertShellReady();
    if (!this.snapshot.playbackReady)
      throw new StudioAdapterError(
        "invalid_state",
        "Wait for every audible track to become ready before playing.",
      );
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
    this.assertShellReady();
    this.runtime?.pause();
    this.setStatus(this.snapshot.playbackReady ? "paused" : "loading");
  }

  seek(seconds: number) {
    this.assertShellReady();
    if (!Number.isFinite(seconds) || seconds < 0)
      throw new StudioAdapterError(
        "invalid_state",
        "Seek time must be non-negative.",
      );
    this.runtime?.seek(seconds);
  }

  async addAudioAsset({ asset, track }: AddAudioAssetInput): Promise<TrackRef> {
    this.assertShellReady();
    if (!this.decodeContext || !this.manifest || !this.actorId)
      throw new StudioAdapterError(
        "invalid_state",
        "Load the studio before adding audio.",
      );
    try {
      const cached = studioSourceBufferRegistry.getOrLoad(
        this.actorId,
        asset.assetId,
        async () => {
          const response = await fetch(asset.url, { cache: "default" });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return this.decodeContext!.decodeAudioData(
            await response.arrayBuffer(),
          );
        },
      );
      const buffer = await cached.promise;
      const manifest = parseWorkspaceManifest({
        ...this.manifest,
        tracks: [...this.manifest.tracks, track],
      });
      this.manifest = manifest;
      this.tracks = [...this.tracks, manifestTrackToClipTrack(track, buffer)];
      this.trackLoadStates.set(track.trackId, {
        trackId: track.trackId,
        assetId: track.assetId,
        status: "ready",
        message: null,
      });
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
    this.assertShellReady();
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
    this.trackLoadStates.delete(id);
    this.emit();
  }

  updateTrack(id: string, patch: TrackPatch) {
    this.assertShellReady();
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
    this.tracks = this.manifest.tracks.map((track) => {
      const existing = this.tracks.find(
        ({ id: trackId }) => trackId === track.trackId,
      );
      return manifestTrackToClipTrack(track, existing?.clips[0]?.audioBuffer);
    });
    this.emit();
  }

  reorderTracks(trackIds: readonly string[]) {
    this.assertShellReady();
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
    this.assertShellReady();
    if (!this.manifest)
      throw new StudioAdapterError("invalid_state", "No manifest is loaded.");
    return parseWorkspaceManifest(
      editorTracksToManifest(this.manifest, this.tracks),
    );
  }

  async renderMix() {
    this.assertShellReady();
    if (!this.allTracksReady())
      throw new StudioAdapterError(
        "export_failed",
        "Wait for every track before exporting a WAV mix.",
      );
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
    this.loadGeneration += 1;
    this.runtime?.pause();
    this.runtime = null;
    await this.decodeContext?.close();
    this.decodeContext = null;
    this.tracks = [];
    this.manifest = null;
    this.trackLoadStates.clear();
    this.disposed = true;
    this.setStatus("disposed");
    this.listeners.clear();
  }

  private acceptSourceStatus(
    generation: number,
    signal: AbortSignal,
    assetId: string,
    status: StudioTrackReadiness,
    error?: StudioAdapterError,
  ) {
    if (signal.aborted || generation !== this.loadGeneration) return;
    this.setTrackStatus(assetId, status, error?.message ?? null);
  }

  private attachBuffer(
    generation: number,
    signal: AbortSignal,
    assetId: string,
    buffer: AudioBuffer,
  ) {
    if (
      signal.aborted ||
      generation !== this.loadGeneration ||
      !this.manifest?.tracks.some((track) => track.assetId === assetId)
    )
      return;
    this.tracks = this.manifest.tracks.map((track) => {
      const existing = this.tracks.find(({ id }) => id === track.trackId);
      return track.assetId === assetId
        ? manifestTrackToClipTrack(track, buffer)
        : existing!;
    });
    this.emit();
  }

  private setTrackStatus(
    assetId: string,
    status: StudioTrackReadiness,
    message: string | null = null,
  ) {
    for (const track of this.manifest?.tracks ?? []) {
      if (track.assetId !== assetId) continue;
      this.trackLoadStates.set(track.trackId, {
        trackId: track.trackId,
        assetId,
        status,
        message,
      });
    }
    this.emit();
  }

  private finishLoadAttempt() {
    if (this.status === "playing" || this.status === "paused") {
      this.emit();
      return;
    }
    if (
      [...this.trackLoadStates.values()].some(
        (item) => item.status === "failed",
      )
    )
      this.status = this.computePlaybackReady() ? "ready" : "error";
    else this.status = this.computePlaybackReady() ? "ready" : "loading";
    this.emit();
  }

  private computePlaybackReady() {
    if (!this.manifest) return false;
    const unmuted = this.manifest.tracks.filter((track) => !track.muted);
    const soloed = unmuted.filter((track) => track.soloed);
    const audible = soloed.length > 0 ? soloed : unmuted;
    return (
      audible.length > 0 &&
      audible.every(
        (track) => this.trackLoadStates.get(track.trackId)?.status === "ready",
      )
    );
  }

  private allTracksReady() {
    return (
      this.trackLoadStates.size > 0 &&
      [...this.trackLoadStates.values()].every(
        (item) => item.status === "ready",
      )
    );
  }

  private assertBrowserAudio() {
    if (!("AudioContext" in window) || !("OfflineAudioContext" in window))
      throw new StudioAdapterError(
        "unsupported",
        "This browser does not support the Web Audio APIs required by the studio.",
      );
  }

  private assertLive() {
    if (this.disposed)
      throw new StudioAdapterError(
        "invalid_state",
        "This studio adapter has been disposed.",
      );
  }

  private assertShellReady() {
    this.assertLive();
    if (!this.manifest)
      throw new StudioAdapterError(
        "invalid_state",
        "Open the studio before using its controls.",
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
      trackLoadStates: [...this.trackLoadStates.values()],
      playbackReady: this.computePlaybackReady(),
    };
    for (const listener of this.listeners) listener();
  }
}
