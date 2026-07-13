"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Waveform,
  WaveformPlaylistProvider,
  usePlaybackAnimation,
  usePlaylistControls,
  usePlaylistData,
} from "@waveform-playlist/browser";
import { useExportWav } from "@waveform-playlist/browser/tone";
import { resumeGlobalAudioContext } from "@waveform-playlist/playout";
import type { StudioLauncherProps } from "../components/studio-launcher.client";
import {
  serializePostgresJsonb,
  sha256PostgresJsonb,
  type WorkspaceManifestV1,
  type WorkspaceTrackV1,
} from "../manifest/schema";
import type { SignedAudioSource } from "../source-contract";
import { StudioAdapterError } from "../studio-adapter.types";
import {
  getAutosaveDelay,
  initialAutosaveState,
  reduceAutosave,
} from "@/features/workspaces/autosave-machine";
import {
  reserveWorkspaceSnapshotAction,
  saveWorkspaceAction,
} from "@/features/workspaces/actions";
import {
  clearLocalRecovery,
  readLocalRecovery,
  writeLocalRecovery,
} from "@/features/workspaces/local-recovery.client";
import type { LocalRecoveryEnvelope } from "@/features/workspaces/schema";
import { StemDownloadPanel } from "@/features/exports/stem-download-panel.client";
import { buildMixFilename } from "@/features/exports/filename";
import { assertMixExportWithinLimits } from "@/features/exports/mix-export";
import {
  publishWorkspaceAction,
  restartWorkspaceAction,
} from "@/features/workspaces/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { gainToDecibels } from "./mapping";
import { WaveformPlaylistStudioAdapter } from "./adapter.client";

type TrackMeta = StudioLauncherProps["tracks"][number];
type EditableProps = Extract<StudioLauncherProps, { mode: "workspace" }>;

const formatTime = (seconds: number) => {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${Math.floor(safe % 60)
    .toString()
    .padStart(2, "0")}`;
};

function PlaybackControls({
  adapter,
  tracks,
  editable,
  onEdited,
  projectTitle,
  revisionNumber,
}: {
  adapter: WaveformPlaylistStudioAdapter;
  tracks: TrackMeta[];
  editable: EditableProps | null;
  onEdited: () => void;
  projectTitle: string;
  revisionNumber?: number;
}) {
  const controls = usePlaylistControls();
  const data = usePlaylistData();
  const { isPlaying } = usePlaybackAnimation();
  const { exportWav, isExporting, progress: exportProgress } = useExportWav();
  const [time, setTime] = useState(0);
  const [audioIssue, setAudioIssue] = useState(false);
  const [mixMessage, setMixMessage] = useState(
    "Stereo 16-bit WAV rendered locally in this browser.",
  );
  const cancelledMix = useRef(false);
  const manifest = adapter.exportManifest();
  const duration = Math.max(
    ...manifest.tracks.map(
      (track) => (track.positionMs + track.durationMs) / 1000,
    ),
  );
  const attemptPlay = useCallback(async () => {
    try {
      await adapter.play();
      setAudioIssue(false);
    } catch {
      setAudioIssue(true);
    }
  }, [adapter]);
  const updateTrack = (
    trackId: string,
    patch: Parameters<typeof adapter.updateTrack>[1],
  ) => {
    adapter.updateTrack(trackId, patch);
    onEdited();
  };
  const moveTrack = (trackId: string, delta: number) => {
    const ids = adapter.exportManifest().tracks.map((track) => track.trackId);
    const index = ids.indexOf(trackId);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    adapter.reorderTracks(ids);
    onEdited();
  };
  useEffect(() => {
    adapter.attachRuntime({
      play: async () => {
        await resumeGlobalAudioContext();
        await controls.play();
      },
      pause: controls.pause,
      seek: controls.seekTo,
      renderMix: async () => {
        const sampleRate = Math.max(
          ...adapter
            .getSnapshot()
            .tracks.flatMap((track) =>
              track.clips.map((clip) => clip.sampleRate),
            ),
        );
        assertMixExportWithinLimits(duration, sampleRate);
        const result = await exportWav(
          adapter.getSnapshot().tracks,
          data.trackStates,
          { mode: "master", bitDepth: 16, autoDownload: false },
        );
        return result.blob;
      },
    });
    const timer = window.setInterval(
      () => setTime(data.playoutRef.current?.getCurrentTime() ?? 0),
      200,
    );
    return () => {
      window.clearInterval(timer);
      adapter.attachRuntime(null);
    };
  }, [
    adapter,
    controls,
    data.playoutRef,
    data.trackStates,
    duration,
    exportWav,
  ]);

  const renderMix = async () => {
    cancelledMix.current = false;
    setMixMessage("Rendering the WAV mix locally…");
    try {
      const blob = await adapter.renderMix();
      if (cancelledMix.current) {
        setMixMessage("Mix save cancelled. The local render has finished.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = buildMixFilename({ projectTitle, revisionNumber });
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setMixMessage("WAV mix ready.");
    } catch (error) {
      setMixMessage(
        error instanceof Error && error.message === "mix_export_too_large"
          ? "This arrangement exceeds the 10-minute or 128 MiB local WAV safety limit. Download the original stems instead."
          : "The WAV mix could not be rendered in this browser.",
      );
    }
  };
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input,select,textarea,[contenteditable='true']"))
        return;
      if (event.code === "Space") {
        event.preventDefault();
        void attemptPlay();
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        controls.seekTo(
          Math.max(
            0,
            Math.min(duration, time + (event.key === "ArrowLeft" ? -5 : 5)),
          ),
        );
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [attemptPlay, controls, duration, time]);
  return (
    <>
      <div
        className="rounded-card border-subtle bg-surface flex flex-wrap items-center gap-3 border p-4"
        aria-label="Playback transport"
      >
        <button
          className="bg-accent rounded-control min-h-11 px-5 font-semibold text-slate-950"
          type="button"
          aria-label={isPlaying ? "Pause playback" : "Play playback"}
          onClick={() => (isPlaying ? adapter.pause() : void attemptPlay())}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        {audioIssue && (
          <button
            className="rounded-control border-accent min-h-11 border px-4"
            type="button"
            onClick={() => void attemptPlay()}
          >
            Enable audio
          </button>
        )}
        <button
          className="rounded-control border-strong min-h-11 border px-4"
          type="button"
          onClick={() => controls.seekTo(Math.max(0, time - 5))}
        >
          Back 5 seconds
        </button>
        <button
          className="rounded-control border-strong min-h-11 border px-4"
          type="button"
          onClick={() => controls.seekTo(Math.min(duration, time + 5))}
        >
          Forward 5 seconds
        </button>
        <span className="font-mono text-sm">
          {formatTime(time)} / {formatTime(duration)}
        </span>
        <label className="min-w-52 flex-1">
          <span className="sr-only">Seek playback position</span>
          <input
            className="w-full"
            aria-label="Seek playback position"
            type="range"
            min="0"
            max={duration}
            step="0.1"
            value={Math.min(time, duration)}
            onChange={(event) => controls.seekTo(Number(event.target.value))}
          />
        </label>
      </div>
      <div className="rounded-card border-subtle bg-surface-raised overflow-x-auto border p-3">
        <Waveform />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {data.tracks.map((track, index) => {
          const meta = tracks.find((item) => item.trackId === track.id);
          const persisted = manifest.tracks.find(
            (item) => item.trackId === track.id,
          )!;
          const current = data.trackStates[index]!;
          const displayedGainDb = editable
            ? persisted.gainDb
            : Number(gainToDecibels(current.volume).toFixed(1));
          return (
            <fieldset
              key={track.id}
              className="rounded-card border-subtle bg-surface space-y-4 border p-4"
            >
              <legend className="px-2 font-semibold">{track.name}</legend>
              <p className="text-muted text-sm">
                {editable
                  ? (editable.instruments.find(
                      (instrument) => instrument.id === persisted.instrumentId,
                    )?.name ?? "No instrument")
                  : (meta?.instrumentName ?? "No instrument")}{" "}
                {" · "}
                {meta?.creditName ?? "Unknown creator"}
              </p>
              {editable && (
                <>
                  <label className="block">
                    Track label
                    <input
                      className="border-subtle mt-1 block min-h-11 w-full border px-3"
                      maxLength={120}
                      defaultValue={persisted.name}
                      onBlur={(event) =>
                        event.target.value.trim() &&
                        updateTrack(track.id, {
                          name: event.target.value.trim(),
                        })
                      }
                    />
                  </label>
                  <label className="block">
                    Instrument
                    <select
                      className="border-subtle mt-1 block min-h-11 w-full border px-3"
                      value={persisted.instrumentId ?? ""}
                      onChange={(event) =>
                        updateTrack(track.id, {
                          instrumentId: event.target.value || null,
                        })
                      }
                    >
                      <option value="">Not specified</option>
                      {editable.instruments.map((instrument) => (
                        <option key={instrument.id} value={instrument.id}>
                          {instrument.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    Start position (seconds)
                    <input
                      className="border-subtle mt-1 block min-h-11 w-full border px-3"
                      type="number"
                      min="0"
                      step="0.001"
                      defaultValue={persisted.positionMs / 1000}
                      onBlur={(event) =>
                        updateTrack(track.id, {
                          positionMs: Math.max(
                            0,
                            Math.round(Number(event.target.value) * 1000),
                          ),
                        })
                      }
                    />
                  </label>
                </>
              )}
              <label className="block">
                Gain <span className="text-muted">{displayedGainDb} dB</span>
                <input
                  aria-label={`${track.name} gain`}
                  className="w-full"
                  type="range"
                  min="-60"
                  max="6"
                  step="0.5"
                  value={displayedGainDb}
                  onChange={(event) => {
                    const gainDb = Number(event.target.value);
                    controls.setTrackVolume(index, Math.pow(10, gainDb / 20));
                    if (editable) updateTrack(track.id, { gainDb });
                  }}
                />
              </label>
              <label className="block">
                Pan <span className="text-muted">{current.pan.toFixed(1)}</span>
                <input
                  aria-label={`${track.name} pan`}
                  className="w-full"
                  type="range"
                  min="-1"
                  max="1"
                  step="0.1"
                  value={current.pan}
                  onChange={(event) => {
                    const pan = Number(event.target.value);
                    controls.setTrackPan(index, pan);
                    if (editable) updateTrack(track.id, { pan });
                  }}
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  aria-pressed={current.muted}
                  className="rounded-control border-strong min-h-11 border px-4"
                  onClick={() => {
                    controls.setTrackMute(index, !current.muted);
                    if (editable)
                      updateTrack(track.id, { muted: !current.muted });
                  }}
                >
                  {current.muted ? "Muted" : "Mute"}
                </button>
                <button
                  type="button"
                  aria-pressed={current.soloed}
                  className="rounded-control border-strong min-h-11 border px-4"
                  onClick={() => {
                    controls.setTrackSolo(index, !current.soloed);
                    if (editable)
                      updateTrack(track.id, { soloed: !current.soloed });
                  }}
                >
                  {current.soloed ? "Soloed" : "Solo"}
                </button>
                {editable && (
                  <>
                    <button
                      type="button"
                      className="rounded-control border-strong min-h-11 border px-4"
                      aria-label={`Move ${track.name} up`}
                      disabled={index === 0}
                      onClick={() => moveTrack(track.id, -1)}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      className="rounded-control border-strong min-h-11 border px-4"
                      aria-label={`Move ${track.name} down`}
                      disabled={index === data.tracks.length - 1}
                      onClick={() => moveTrack(track.id, 1)}
                    >
                      Move down
                    </button>
                    <button
                      type="button"
                      className="rounded-control min-h-11 border border-red-700 px-4 text-red-700"
                      aria-label={`Remove ${track.name} from draft`}
                      disabled={data.tracks.length === 1}
                      onClick={() => {
                        adapter.removeTrack(track.id);
                        onEdited();
                      }}
                    >
                      Remove from draft
                    </button>
                  </>
                )}
              </div>
            </fieldset>
          );
        })}
      </div>
      <div className="rounded-card border-subtle bg-surface border p-5">
        <h2 className="font-bold">Export WAV mix</h2>
        <p className="text-muted mt-1 text-sm">{mixMessage}</p>
        {isExporting && (
          <progress className="mt-3 w-full" max={1} value={exportProgress}>
            {Math.round(exportProgress * 100)}%
          </progress>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-control border-strong min-h-11 border px-4 disabled:opacity-50"
            disabled={isExporting || duration > 600}
            onClick={() => void renderMix()}
          >
            Export WAV mix
          </button>
          {isExporting && (
            <button
              type="button"
              className="rounded-control border-strong min-h-11 border px-4"
              onClick={() => {
                cancelledMix.current = true;
                setMixMessage(
                  "Mix save cancelled. Rendering may finish in the background.",
                );
              }}
            >
              Cancel mix save
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export function StudioSurface(props: StudioLauncherProps) {
  const editable = props.mode === "workspace" ? props : null;
  const [adapter, setAdapter] = useState(
    () => new WaveformPlaylistStudioAdapter(),
  );
  const snapshot = useSyncExternalStore(
    adapter.subscribe,
    adapter.getSnapshot,
    adapter.getSnapshot,
  );
  const [message, setMessage] = useState("Requesting private audio access…");
  const [trackMeta, setTrackMeta] = useState(props.tracks);
  const [autosave, dispatchAutosave] = useReducer(
    reduceAutosave,
    initialAutosaveState,
  );
  const [pendingManifest, setPendingManifest] =
    useState<WorkspaceManifestV1 | null>(null);
  const latestManifest = useRef<WorkspaceManifestV1 | null>(null);
  const [editGeneration, setEditGeneration] = useState(0);
  const lockVersion = useRef(editable?.lockVersion ?? 0);
  const baseRevisionId = useRef(editable?.baseRevisionId ?? "");
  const currentRevisionId = useRef(editable?.currentRevisionId ?? "");
  const saving = useRef(false);
  const dirtySince = useRef<number | null>(null);
  const autosaveStatus = useRef(autosave.status);
  const controller = useRef<AbortController | null>(null);
  const disposalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [recovery, setRecovery] = useState<LocalRecoveryEnvelope | null>(null);
  const [publishMessage, setPublishMessage] = useState("");
  const [publishState, setPublishState] = useState<
    | { status: "idle" }
    | { status: "publishing" }
    | { status: "published"; revisionNumber: number }
    | { status: "stale" }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const publishRequestId = useRef<string | null>(null);
  useEffect(() => {
    autosaveStatus.current = autosave.status;
  }, [autosave.status]);
  const initialAssetIds = useMemo(
    () => props.manifest.tracks.map((track) => track.assetId),
    [props.manifest],
  );

  const sourceEndpoint =
    props.mode === "workspace"
      ? `/api/projects/${props.projectId}/workspaces/${props.workspaceId}/audio-sources`
      : `/api/projects/${props.projectId}/revisions/${props.revisionId}/audio-sources`;
  const signLoad = useCallback(async (): Promise<SignedAudioSource[]> => {
    const response = await fetch(sourceEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        editable
          ? { mode: "load", assetIds: initialAssetIds }
          : { assetIds: initialAssetIds },
      ),
      cache: "no-store",
    });
    if (!response.ok)
      throw new StudioAdapterError(
        response.status === 401 ? "unauthorized_source" : "fetch_failed",
        response.status === 401
          ? "Sign in again to access this audio."
          : "Private audio access is unavailable. Retry the studio.",
      );
    const value = (await response.json()) as { sources: SignedAudioSource[] };
    return value.sources;
  }, [editable, initialAssetIds, sourceEndpoint]);
  const signAdd = useCallback(
    async (assetId: string) => {
      if (!editable) throw new Error("read_only");
      const response = await fetch(sourceEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "add", assetId }),
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error("This stem is no longer available to add.");
      const value = (await response.json()) as { sources: SignedAudioSource[] };
      return value.sources[0]!;
    },
    [editable, sourceEndpoint],
  );

  const cachePending = useCallback(
    async (manifest: WorkspaceManifestV1, state: "pending" | "conflict") => {
      if (!editable) return;
      const manifestSha256 = await sha256PostgresJsonb(manifest);
      writeLocalRecovery({
        version: 1,
        viewerId: editable.viewerId,
        projectId: editable.projectId,
        workspaceId: editable.workspaceId,
        baseRevisionId: baseRevisionId.current,
        serverLockVersion: lockVersion.current,
        manifest,
        manifestSha256,
        savedAt: new Date().toISOString(),
        state,
      });
    },
    [editable],
  );
  const markEdited = useCallback(() => {
    const manifest = adapter.exportManifest();
    dirtySince.current ??= Date.now();
    latestManifest.current = manifest;
    setPendingManifest(manifest);
    setEditGeneration((value) => value + 1);
    dispatchAutosave({ type: "edit" });
    void cachePending(manifest, "pending");
  }, [adapter, cachePending]);

  const performSave = useCallback(async () => {
    if (!editable || saving.current || autosave.status === "conflict") return;
    const manifest = latestManifest.current;
    if (!manifest) return;
    if (!navigator.onLine) {
      dispatchAutosave({ type: "offline" });
      return;
    }
    saving.current = true;
    dispatchAutosave({ type: "save" });
    const requestId = crypto.randomUUID();
    const serialized = serializePostgresJsonb(manifest);
    const bytes = new TextEncoder().encode(serialized);
    const manifestSha256 = await sha256PostgresJsonb(manifest);
    try {
      const reservation = await reserveWorkspaceSnapshotAction({
        workspaceId: editable.workspaceId,
        requestId,
        expectedLockVersion: lockVersion.current,
        manifestSha256,
        byteSize: bytes.byteLength,
      });
      if (!reservation.ok) {
        if (reservation.code === "conflict") {
          dispatchAutosave({ type: "conflict" });
          await cachePending(manifest, "conflict");
          return;
        }
        throw new Error("Draft reservation is unavailable.");
      }
      const db = createSupabaseBrowserClient();
      const { error: uploadError } = await db.storage
        .from(reservation.bucket)
        .upload(reservation.objectPath, new Blob([bytes]), {
          contentType: "application/json",
          cacheControl: "0",
          upsert: false,
        });
      const status = Number(
        (uploadError as { statusCode?: number | string } | null)?.statusCode,
      );
      if (uploadError && status !== 409)
        throw new Error("The private snapshot upload was interrupted.");
      const result = await saveWorkspaceAction({
        workspaceId: editable.workspaceId,
        requestId,
        expectedLockVersion: lockVersion.current,
        snapshotAssetId: reservation.assetId,
        manifest,
      });
      if (!result.ok) {
        if (result.code === "conflict") {
          dispatchAutosave({ type: "conflict" });
          await cachePending(manifest, "conflict");
          return;
        }
        throw new Error(
          result.code === "invalid_state"
            ? "A track or snapshot changed. Review the draft and retry."
            : "The draft could not be saved. Retry when connected.",
        );
      }
      lockVersion.current = result.lockVersion;
      const current = latestManifest.current;
      if (
        current &&
        serializePostgresJsonb(current) === serializePostgresJsonb(manifest)
      ) {
        latestManifest.current = null;
        dirtySince.current = null;
        setPendingManifest(null);
        clearLocalRecovery(editable.viewerId, editable.workspaceId);
        dispatchAutosave({ type: "saved" });
      } else {
        dispatchAutosave({ type: "edit" });
        setEditGeneration((value) => value + 1);
      }
    } catch (error) {
      if (navigator.onLine)
        dispatchAutosave({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "The draft could not be saved.",
        });
      else dispatchAutosave({ type: "offline" });
    } finally {
      saving.current = false;
    }
  }, [autosave.status, cachePending, editable]);

  useEffect(() => {
    if (
      !editable ||
      !pendingManifest ||
      ["conflict", "offline", "error", "saving"].includes(autosave.status)
    )
      return;
    const timer = window.setTimeout(
      () => void performSave(),
      getAutosaveDelay(dirtySince.current ?? Date.now(), Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [autosave.status, editGeneration, editable, pendingManifest, performSave]);

  useEffect(() => {
    if (!editable) return;
    const online = () => {
      if (latestManifest.current) {
        dispatchAutosave({ type: "retry" });
        setEditGeneration((value) => value + 1);
      }
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!latestManifest.current) return;
      event.preventDefault();
    };
    window.addEventListener("online", online);
    if (pendingManifest || autosave.status === "conflict")
      window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [autosave.status, editable, pendingManifest]);

  useEffect(() => {
    if (disposalTimer.current) clearTimeout(disposalTimer.current);
    const abort = new AbortController();
    controller.current = abort;
    const pagehide = () => {
      if (latestManifest.current)
        void cachePending(
          latestManifest.current,
          autosaveStatus.current === "conflict" ? "conflict" : "pending",
        );
      abort.abort();
      void adapter.dispose();
    };
    window.addEventListener("pagehide", pagehide);
    void (async () => {
      try {
        const sources = await signLoad();
        await adapter.load({
          manifest: props.manifest,
          sources,
          refreshSources: signLoad,
          signal: abort.signal,
          onProgress: (loaded, total) =>
            setMessage(`Loading ${loaded} of ${total} stems`),
        });
        setMessage(
          editable
            ? "Ready. Draft edits autosave privately."
            : "Ready. Listening changes are session-only.",
        );
        if (editable) {
          const local = readLocalRecovery(
            editable.viewerId,
            editable.workspaceId,
          );
          if (local && local.manifestSha256 !== editable.manifestSha256)
            setRecovery(local);
          else if (local)
            clearLocalRecovery(editable.viewerId, editable.workspaceId);
        }
      } catch (error) {
        if (!abort.signal.aborted)
          setMessage(
            error instanceof Error ? error.message : "Studio could not open.",
          );
      }
    })();
    return () => {
      window.removeEventListener("pagehide", pagehide);
      abort.abort();
      disposalTimer.current = setTimeout(() => void adapter.dispose(), 0);
    };
  }, [adapter, cachePending, editable, props.manifest, signLoad]);

  const restoreRecovery = async () => {
    if (!editable || !recovery) return;
    try {
      const current = adapter.exportManifest();
      for (const track of recovery.manifest.tracks) {
        if (current.tracks.some((item) => item.assetId === track.assetId))
          continue;
        const option = editable.assets.find(
          (asset) => asset.id === track.assetId,
        );
        if (!option) throw new Error("A pending stem is no longer available.");
        const source = await signAdd(track.assetId);
        await adapter.addAudioAsset({
          asset: { assetId: source.assetId, url: source.signedUrl },
          track,
        });
        setTrackMeta((items) => [
          ...items,
          {
            trackId: track.trackId,
            creditName: option.creditName,
            instrumentName: null,
          },
        ]);
      }
      for (const track of adapter.exportManifest().tracks) {
        if (
          !recovery.manifest.tracks.some(
            (item) => item.trackId === track.trackId,
          )
        )
          adapter.removeTrack(track.trackId);
      }
      for (const track of recovery.manifest.tracks)
        adapter.updateTrack(track.trackId, {
          name: track.name,
          instrumentId: track.instrumentId,
          positionMs: track.positionMs,
          gainDb: track.gainDb,
          pan: track.pan,
          muted: track.muted,
          soloed: track.soloed,
        });
      adapter.reorderTracks(
        recovery.manifest.tracks.map((track) => track.trackId),
      );
      setRecovery(null);
      markEdited();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Recovery could not be applied.",
      );
    }
  };

  const addSelectedAsset = async () => {
    if (!editable || !selectedAssetId) return;
    const option = editable.assets.find(
      (asset) => asset.id === selectedAssetId,
    );
    if (!option) return;
    try {
      const source = await signAdd(option.id);
      const track: WorkspaceTrackV1 = {
        trackId: crypto.randomUUID(),
        assetId: option.id,
        instrumentId: null,
        name: option.filename.replace(/\.[^.]+$/, "").slice(0, 120),
        positionMs: 0,
        trimStartMs: 0,
        durationMs: option.durationMs,
        gainDb: 0,
        pan: 0,
        muted: false,
        soloed: false,
        sortOrder: adapter.exportManifest().tracks.length,
      };
      await adapter.addAudioAsset({
        asset: { assetId: source.assetId, url: source.signedUrl },
        track,
      });
      setTrackMeta((items) => [
        ...items,
        {
          trackId: track.trackId,
          instrumentName: null,
          creditName: option.creditName,
        },
      ]);
      setSelectedAssetId("");
      markEdited();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The stem could not be added.",
      );
    }
  };

  const publishWorkspace = async () => {
    if (!editable) return;
    publishRequestId.current ??= crypto.randomUUID();
    setPublishState({ status: "publishing" });
    const result = await publishWorkspaceAction(editable.projectId, {
      workspaceId: editable.workspaceId,
      requestId: publishRequestId.current,
      expectedLockVersion: lockVersion.current,
      expectedBaseRevisionId: baseRevisionId.current,
      message: publishMessage.trim() || null,
    });
    if (!result.ok) {
      if (result.code === "stale_base") setPublishState({ status: "stale" });
      else
        setPublishState({
          status: "error",
          message:
            result.code === "conflict"
              ? "The saved draft changed. Reload before publishing."
              : result.code === "quota"
                ? "This revision exceeds the project storage limit."
                : "The workspace could not be published. Retry with the same saved draft.",
        });
      return;
    }
    lockVersion.current = result.workspaceLockVersion;
    baseRevisionId.current = result.revisionId;
    currentRevisionId.current = result.revisionId;
    publishRequestId.current = null;
    clearLocalRecovery(editable.viewerId, editable.workspaceId);
    setPublishState({
      status: "published",
      revisionNumber: result.revisionNumber,
    });
  };

  const restartWorkspace = async () => {
    if (!editable) return;
    if (
      !window.confirm(
        "Archive this stale draft and restart from the current revision? Draft edits will not be copied automatically.",
      )
    )
      return;
    const result = await restartWorkspaceAction(editable.projectId, {
      workspaceId: editable.workspaceId,
      requestId: crypto.randomUUID(),
      expectedLockVersion: lockVersion.current,
      expectedBaseRevisionId: baseRevisionId.current,
      expectedCurrentRevisionId: currentRevisionId.current,
    });
    if (!result.ok) {
      setPublishState({
        status: "error",
        message:
          "The project changed again. Reload before restarting the draft.",
      });
      return;
    }
    clearLocalRecovery(editable.viewerId, editable.workspaceId);
    location.reload();
  };

  const ready = ["ready", "playing", "paused"].includes(snapshot.status);
  const addedAssetIds = new Set(
    snapshot.manifest?.tracks.map((track) => track.assetId) ?? [],
  );
  return (
    <section className="space-y-6">
      <div
        aria-live="polite"
        className="rounded-control border-subtle bg-surface border p-4"
      >
        <strong>Status:</strong> {editable ? autosave.message : message}
        {editable && (
          <span className="text-muted ml-2 text-sm">
            Last server copy {new Date(editable.updatedAt).toLocaleTimeString()}
          </span>
        )}
        {editable && (
          <span className="text-muted block text-sm">Audio: {message}</span>
        )}
      </div>
      {recovery && (
        <div role="alert" className="rounded-card border-accent border p-5">
          <h2 className="font-bold">Pending changes found on this device</h2>
          <p className="text-muted mt-1">
            The server draft remains authoritative until you restore and save
            this copy.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="bg-accent rounded-control min-h-11 px-4 font-semibold text-slate-950"
              onClick={() => void restoreRecovery()}
            >
              Restore pending changes
            </button>
            <button
              type="button"
              className="rounded-control border-strong min-h-11 border px-4"
              onClick={() => {
                if (!editable) return;
                clearLocalRecovery(editable.viewerId, editable.workspaceId);
                setRecovery(null);
              }}
            >
              Discard local copy
            </button>
          </div>
        </div>
      )}
      {autosave.status === "conflict" && editable && (
        <div role="alert" className="rounded-card border border-red-700 p-5">
          <h2 className="font-bold">This draft changed in another tab</h2>
          <p className="text-muted mt-1">
            Your pending copy remains on this device. Reload to use the newer
            server draft; Jam Session will not overwrite it automatically.
          </p>
          <button
            type="button"
            className="rounded-control border-strong mt-4 min-h-11 border px-4"
            onClick={() => {
              if (
                window.confirm(
                  "Reload the saved draft? Your pending local copy will remain available on this device.",
                )
              )
                location.reload();
            }}
          >
            Reload saved draft
          </button>
        </div>
      )}
      {!ready ? (
        <button
          type="button"
          className="rounded-control border-strong min-h-11 border px-5"
          onClick={() => {
            controller.current?.abort();
            setAdapter(new WaveformPlaylistStudioAdapter());
          }}
        >
          Retry
        </button>
      ) : (
        snapshot.tracks.length > 0 && (
          <>
            {editable && (
              <div className="rounded-card border-subtle bg-surface flex flex-wrap items-end gap-3 border p-5">
                <label className="min-w-64 flex-1">
                  Add one of your ready stems
                  <select
                    className="border-subtle mt-1 block min-h-11 w-full border px-3"
                    value={selectedAssetId}
                    onChange={(event) => setSelectedAssetId(event.target.value)}
                  >
                    <option value="">Choose a stem</option>
                    {editable.assets
                      .filter((asset) => !addedAssetIds.has(asset.id))
                      .map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.filename} ·{" "}
                          {(asset.durationMs / 1000).toFixed(1)}s
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="bg-accent rounded-control min-h-11 px-5 font-semibold text-slate-950 disabled:opacity-50"
                  disabled={!selectedAssetId || snapshot.tracks.length >= 12}
                  onClick={() => void addSelectedAsset()}
                >
                  Add stem
                </button>
                <Link className="min-h-11 py-2 underline" href="/uploads">
                  Upload another stem
                </Link>
              </div>
            )}
            <WaveformPlaylistProvider
              tracks={snapshot.tracks}
              timescale
              controls={{ show: false, width: 0 }}
              waveHeight={96}
              samplesPerPixel={512}
            >
              <PlaybackControls
                adapter={adapter}
                tracks={trackMeta}
                editable={editable}
                onEdited={markEdited}
                projectTitle={props.projectTitle}
                revisionNumber={
                  props.mode === "revision" ? props.revisionNumber : undefined
                }
              />
            </WaveformPlaylistProvider>
          </>
        )
      )}
      {editable ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-control border-strong min-h-11 border px-4 disabled:opacity-50"
              disabled={
                !pendingManifest ||
                autosave.status === "saving" ||
                autosave.status === "conflict"
              }
              onClick={() => void performSave()}
            >
              Save now
            </button>
            <p className="text-muted text-sm">
              Draft edits are private and unpublished. Removing a track does not
              delete its uploaded source.
            </p>
          </div>
          <section className="rounded-card border-strong border p-5">
            <h2 className="font-bold">Publish saved workspace</h2>
            <p className="text-muted mt-1 text-sm">
              Publishing creates a new immutable revision. It never changes the
              previous revision.
            </p>
            <label className="mt-4 block">
              Revision message (optional)
              <textarea
                className="border-subtle mt-1 block min-h-24 w-full border p-3"
                maxLength={500}
                value={publishMessage}
                onChange={(event) => setPublishMessage(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="bg-accent rounded-control mt-4 min-h-11 px-5 font-semibold text-slate-950 disabled:opacity-50"
              disabled={
                autosave.status !== "saved" ||
                Boolean(pendingManifest) ||
                publishState.status === "publishing"
              }
              onClick={() => void publishWorkspace()}
            >
              {publishState.status === "publishing"
                ? "Publishing…"
                : "Publish revision"}
            </button>
            {publishState.status === "published" && (
              <p className="mt-3" role="status">
                Revision {publishState.revisionNumber} published. This workspace
                now continues from it.
              </p>
            )}
            {publishState.status === "error" && (
              <p className="mt-3" role="alert">
                {publishState.message}
              </p>
            )}
            {publishState.status === "stale" && (
              <div className="mt-4" role="alert">
                <p>
                  The project has a newer revision. Jam Session will not merge
                  or overwrite it automatically.
                </p>
                <button
                  type="button"
                  className="rounded-control border-strong mt-3 min-h-11 border px-4"
                  onClick={() => void restartWorkspace()}
                >
                  Restart draft from current revision
                </button>
              </div>
            )}
          </section>
        </div>
      ) : (
        <p className="text-muted text-sm">
          Listening changes are session-only.
        </p>
      )}
      <StemDownloadPanel
        endpoint={
          props.mode === "workspace"
            ? `/api/projects/${props.projectId}/workspaces/${props.workspaceId}/downloads/stems`
            : `/api/projects/${props.projectId}/revisions/${props.revisionId}/downloads/stems`
        }
        assetIds={snapshot.manifest?.tracks.map((track) => track.assetId) ?? []}
        disabled={Boolean(editable && autosave.status !== "saved")}
      />
    </section>
  );
}
