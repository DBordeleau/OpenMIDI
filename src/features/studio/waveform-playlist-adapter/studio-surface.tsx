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
  usePlaylistState,
} from "@waveform-playlist/browser";
import { useExportWav } from "@waveform-playlist/browser/tone";
import { resumeGlobalAudioContext } from "@waveform-playlist/playout";
import type { WaveformPlaylistTheme } from "@waveform-playlist/ui-components";
import {
  FiChevronDown,
  FiChevronUp,
  FiCrosshair,
  FiFastForward,
  FiAlertCircle,
  FiCheckCircle,
  FiLoader,
  FiPause,
  FiPlay,
  FiRewind,
  FiTrash2,
  FiZoomIn,
  FiZoomOut,
} from "react-icons/fi";
import type { StudioLauncherProps } from "../components/studio-launcher.client";
import {
  useStudioFileActions,
  useStudioLifecycleRegistration,
} from "../components/studio-shell.client";
import { MutableStudioLifecycle } from "../switch-coordinator";
import {
  serializePostgresJsonb,
  sha256PostgresJsonb,
  parseWorkspaceManifest,
  type WorkspaceManifestV1,
  type WorkspaceTrackV1,
} from "../manifest/schema";
import {
  parseWorkspaceManifestV2,
  type WorkspaceManifestV2,
} from "../manifest/v2";
import { mapManifestV1ToV2 } from "../manifest/v1-to-v2";
import type { SignedAudioSource } from "../source-contract";
import { StudioAdapterError } from "../studio-adapter.types";
import {
  getAutosaveDelay,
  initialAutosaveState,
  reduceAutosave,
} from "@/features/workspaces/autosave-machine";
import {
  reserveWorkspaceSnapshotAction,
  saveMidiWorkspaceAction,
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
import { hasAlignedMixerState } from "./mixer-state";
import {
  markStudioPerformance,
  studioPerformanceMarks,
} from "./performance-marks.client";
import {
  WaveformPlaylistStudioAdapter,
  type StudioAdapterSnapshot,
} from "./adapter.client";
import { clearStudioSourceBufferRegistry } from "./source-buffer-registry.client";

type TrackMeta = StudioLauncherProps["tracks"][number];
type WorkspaceProps = Extract<
  StudioLauncherProps,
  { mode: "workspace" | "contribution" }
>;
type EditableProps = WorkspaceProps;

const formatTime = (seconds: number) => {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${Math.floor(safe % 60)
    .toString()
    .padStart(2, "0")}`;
};

const studioBtnPrimary =
  "cta-gradient inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-transform hover:-translate-y-px disabled:opacity-50 disabled:hover:translate-y-0";
const studioBtnGhost =
  "border-strong hover:border-accent hover:text-accent inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors disabled:opacity-50";
const studioIconBtn =
  "border-strong text-muted hover:border-accent hover:text-accent grid h-11 w-11 place-items-center rounded-full border text-lg transition-colors disabled:opacity-40";
const trackIconBtn =
  "border-strong text-muted hover:border-accent hover:text-accent grid h-7 w-7 place-items-center rounded-md border text-sm transition-colors disabled:opacity-40";

function trackChip(active: boolean, kind: "mute" | "solo") {
  const base =
    "grid h-7 w-8 place-items-center rounded-md border text-xs font-bold transition-colors";
  if (!active) return `border-strong text-muted ${base}`;
  const tone = kind === "mute" ? "bg-accent" : "bg-accent-2";
  return `${tone} text-accent-contrast border-transparent ${base}`;
}

// Canvas colors are drawn by the engine (not CSS) — theme them to the warm
// brand palette so the waveform reads on the dark studio surface.
const studioTheme: Partial<WaveformPlaylistTheme> = {
  waveformDrawMode: "normal",
  waveOutlineColor: "#171019",
  waveFillColor: "#ff8d63",
  waveProgressColor: "#ffc879",
  backgroundColor: "#1e1524",
  playlistBackgroundColor: "#1e1524",
  surfaceColor: "#1e1524",
  borderColor: "rgba(255, 255, 255, 0.1)",
  timeColor: "#c6adb4",
  timescaleBackgroundColor: "#1e1524",
  playheadColor: "#fff0e1",
  selectionColor: "rgba(255, 141, 99, 0.22)",
  textColor: "#f7efe9",
  textColorMuted: "#c6adb4",
};

function createPreparedAdapter(manifest: WorkspaceManifestV1, actorId: string) {
  const adapter = new WaveformPlaylistStudioAdapter();
  adapter.prepare(manifest, actorId);
  return adapter;
}

function PlaybackControls({
  adapter,
  snapshot,
  tracks,
  editable,
  onEdited,
  onRetryTrack,
  projectTitle,
  revisionNumber,
}: {
  adapter: WaveformPlaylistStudioAdapter;
  snapshot: StudioAdapterSnapshot;
  tracks: TrackMeta[];
  editable: EditableProps | null;
  onEdited: () => void;
  onRetryTrack: (trackId: string) => void;
  projectTitle: string;
  revisionNumber?: number;
}) {
  const controls = usePlaylistControls();
  const data = usePlaylistData();
  const { isPlaying } = usePlaybackAnimation();
  const playlistState = usePlaylistState();
  const scrollRef = useRef<HTMLDivElement>(null);
  const exportSectionRef = useRef<HTMLDivElement>(null);
  const studioFileActions = useMemo(
    () => ({
      openExport: () => {
        exportSectionRef.current?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
          block: "center",
        });
        exportSectionRef.current?.focus({ preventScroll: true });
      },
    }),
    [],
  );
  useStudioFileActions(studioFileActions);
  const { exportWav, isExporting, progress: exportProgress } = useExportWav();
  const [time, setTime] = useState(0);
  const [audioIssue, setAudioIssue] = useState(false);
  const [mixMessage, setMixMessage] = useState(
    "Stereo 16-bit WAV rendered locally in this browser.",
  );
  const cancelledMix = useRef(false);
  const manifest = adapter.exportManifest();
  const mixerReady =
    snapshot.trackLoadStates.every((track) => track.status === "ready") &&
    hasAlignedMixerState({
      trackIds: data.tracks.map((track) => track.id),
      trackStateCount: data.trackStates.length,
      persistedTrackIds: manifest.tracks.map((track) => track.trackId),
    });
  const duration = Math.max(
    ...manifest.tracks.map(
      (track) => (track.positionMs + track.durationMs) / 1000,
    ),
  );
  const attemptPlay = useCallback(async () => {
    if (!snapshot.playbackReady) return;
    try {
      await adapter.play();
      setAudioIssue(false);
    } catch {
      setAudioIssue(true);
    }
  }, [adapter, snapshot.playbackReady]);
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
    if (!mixerReady) {
      setMixMessage("Preparing mixer controls…");
      return;
    }
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

  useEffect(() => {
    controls.setScrollContainer(scrollRef.current);
    return () => controls.setScrollContainer(null);
  }, [controls]);

  const renderTrackControls = (trackIndex: number) => {
    const track = data.tracks[trackIndex];
    if (!track) return null;
    const meta = tracks.find((item) => item.trackId === track.id);
    const persisted = manifest.tracks.find((item) => item.trackId === track.id);
    const current =
      data.trackStates[trackIndex] ??
      (persisted
        ? {
            name: persisted.name,
            muted: persisted.muted,
            soloed: persisted.soloed,
            volume: Math.pow(10, persisted.gainDb / 20),
            pan: persisted.pan,
          }
        : null);
    if (!persisted || !current)
      return <div className="text-muted p-3 text-xs">Preparing…</div>;
    const readiness = snapshot.trackLoadStates.find(
      (item) => item.trackId === track.id,
    );
    const displayedGainDb = editable
      ? persisted.gainDb
      : Number(gainToDecibels(current.volume).toFixed(1));
    const instrumentName = editable
      ? (editable.instruments.find(
          (instrument) => instrument.id === persisted.instrumentId,
        )?.name ?? "No instrument")
      : (meta?.instrumentName ?? "No instrument");
    const sliderLabel =
      "text-muted flex items-center justify-between text-[10px] font-medium tracking-wide uppercase";
    const detailField =
      "border-strong bg-canvas rounded-control text-ink mt-1 min-h-8 w-full border px-2 text-xs";
    return (
      <div className="bg-surface border-subtle flex h-full flex-col gap-2 overflow-y-auto border-r p-2.5">
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            {editable ? (
              <input
                aria-label={`${track.name} label`}
                className="hover:bg-surface-raised focus:bg-surface-raised -mx-1 block w-full truncate rounded px-1 text-sm font-semibold outline-none"
                maxLength={120}
                defaultValue={persisted.name}
                onBlur={(event) =>
                  event.target.value.trim() &&
                  updateTrack(track.id, { name: event.target.value.trim() })
                }
              />
            ) : (
              <p className="truncate text-sm font-semibold">{track.name}</p>
            )}
            <p className="text-muted truncate text-[11px]">
              {instrumentName} · {meta?.creditName ?? "Unknown creator"}
            </p>
            <p
              className={`mt-1 flex items-center gap-1 text-[10px] font-semibold tracking-wide uppercase ${
                readiness?.status === "ready"
                  ? "text-accent-2"
                  : readiness?.status === "failed"
                    ? "text-danger"
                    : "text-muted"
              }`}
            >
              {readiness?.status === "ready" ? (
                <FiCheckCircle />
              ) : readiness?.status === "failed" ? (
                <FiAlertCircle />
              ) : (
                <FiLoader aria-hidden className="motion-safe:animate-spin" />
              )}
              {readiness?.status ?? "queued"}
              {readiness?.waveformStatus === "persisted" && (
                <span className="sr-only">
                  Waveform ready from persisted peaks.
                </span>
              )}
            </p>
          </div>
          {editable && (
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                className={trackIconBtn}
                aria-label={`Move ${track.name} up`}
                disabled={trackIndex === 0}
                onClick={() => moveTrack(track.id, -1)}
              >
                <FiChevronUp />
              </button>
              <button
                type="button"
                className={trackIconBtn}
                aria-label={`Move ${track.name} down`}
                disabled={trackIndex === data.tracks.length - 1}
                onClick={() => moveTrack(track.id, 1)}
              >
                <FiChevronDown />
              </button>
              <button
                type="button"
                className="border-strong text-muted hover:border-danger hover:text-danger grid h-7 w-7 place-items-center rounded-md border text-sm transition-colors disabled:opacity-40"
                aria-label={`Remove ${track.name} from draft`}
                disabled={data.tracks.length === 1}
                onClick={() => {
                  adapter.removeTrack(track.id);
                  onEdited();
                }}
              >
                <FiTrash2 />
              </button>
            </div>
          )}
        </div>
        <div>
          <div className={sliderLabel}>
            <span>Gain</span>
            <span className="text-ink font-mono normal-case">
              {displayedGainDb} dB
            </span>
          </div>
          <input
            aria-label={`${track.name} gain`}
            className="accent-accent mt-0.5 w-full"
            type="range"
            min="-60"
            max="6"
            step="0.5"
            value={displayedGainDb}
            onChange={(event) => {
              const gainDb = Number(event.target.value);
              if (snapshot.playbackReady)
                controls.setTrackVolume(trackIndex, Math.pow(10, gainDb / 20));
              adapter.updateTrack(track.id, { gainDb });
              if (editable) onEdited();
            }}
          />
        </div>
        <div>
          <div className={sliderLabel}>
            <span>Pan</span>
            <span className="text-ink font-mono normal-case">
              {current.pan.toFixed(1)}
            </span>
          </div>
          <input
            aria-label={`${track.name} pan`}
            className="accent-accent mt-0.5 w-full"
            type="range"
            min="-1"
            max="1"
            step="0.1"
            value={current.pan}
            onChange={(event) => {
              const pan = Number(event.target.value);
              if (snapshot.playbackReady) controls.setTrackPan(trackIndex, pan);
              adapter.updateTrack(track.id, { pan });
              if (editable) onEdited();
            }}
          />
        </div>
        <div className="mt-auto flex items-center gap-1.5">
          <button
            type="button"
            title={current.muted ? "Muted" : "Mute"}
            aria-pressed={current.muted}
            className={trackChip(current.muted, "mute")}
            onClick={() => {
              if (snapshot.playbackReady)
                controls.setTrackMute(trackIndex, !current.muted);
              adapter.updateTrack(track.id, { muted: !current.muted });
              if (editable) onEdited();
            }}
          >
            M
          </button>
          <button
            type="button"
            title={current.soloed ? "Soloed" : "Solo"}
            aria-pressed={current.soloed}
            className={trackChip(current.soloed, "solo")}
            onClick={() => {
              if (snapshot.playbackReady)
                controls.setTrackSolo(trackIndex, !current.soloed);
              adapter.updateTrack(track.id, { soloed: !current.soloed });
              if (editable) onEdited();
            }}
          >
            S
          </button>
        </div>
        {editable && (
          <details className="text-[11px]">
            <summary className="text-muted hover:text-accent cursor-pointer text-[10px] font-medium tracking-wide uppercase select-none">
              Details
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <label className="text-muted">
                Instrument
                <select
                  aria-label={`${track.name} instrument`}
                  className={detailField}
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
              <label className="text-muted">
                Start (seconds)
                <input
                  aria-label={`${track.name} start position`}
                  className={detailField}
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
            </div>
          </details>
        )}
        {readiness?.status === "failed" && (
          <button
            type="button"
            className="border-danger text-danger hover:bg-danger/10 min-h-8 rounded-full border px-3 text-xs font-semibold"
            onClick={() => onRetryTrack(track.id)}
          >
            Retry audio
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <div
        className="rounded-card border-subtle bg-surface flex flex-wrap items-center gap-2 border p-3"
        aria-label="Playback transport"
      >
        <button
          className={studioBtnPrimary}
          type="button"
          aria-label={isPlaying ? "Pause playback" : "Play playback"}
          disabled={!snapshot.playbackReady}
          onClick={() => (isPlaying ? adapter.pause() : void attemptPlay())}
        >
          {isPlaying ? <FiPause /> : <FiPlay />}
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          className={studioIconBtn}
          type="button"
          title="Back 5 seconds"
          aria-label="Back 5 seconds"
          onClick={() => controls.seekTo(Math.max(0, time - 5))}
        >
          <FiRewind />
        </button>
        <button
          className={studioIconBtn}
          type="button"
          title="Forward 5 seconds"
          aria-label="Forward 5 seconds"
          onClick={() => controls.seekTo(Math.min(duration, time + 5))}
        >
          <FiFastForward />
        </button>
        {audioIssue && (
          <button
            className={studioBtnGhost}
            type="button"
            onClick={() => void attemptPlay()}
          >
            Enable audio
          </button>
        )}
        <span className="ml-1 font-mono text-sm">
          {formatTime(time)} / {formatTime(duration)}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            className={studioIconBtn}
            type="button"
            aria-label="Zoom out"
            title="Zoom out"
            disabled={!data.canZoomOut}
            onClick={() => controls.zoomOut()}
          >
            <FiZoomOut />
          </button>
          <button
            className={studioIconBtn}
            type="button"
            aria-label="Zoom in"
            title="Zoom in"
            disabled={!data.canZoomIn}
            onClick={() => controls.zoomIn()}
          >
            <FiZoomIn />
          </button>
          <button
            className={`${studioBtnGhost} ${playlistState.isAutomaticScroll ? "border-accent text-accent" : ""}`}
            type="button"
            title="Keep the view on the playhead"
            aria-pressed={playlistState.isAutomaticScroll}
            onClick={() =>
              controls.setAutomaticScroll(!playlistState.isAutomaticScroll)
            }
          >
            <FiCrosshair />
            Follow
          </button>
        </div>
      </div>
      {!snapshot.playbackReady && (
        <p className="text-muted text-sm" role="status">
          Play unlocks when every audible track is ready. Muted tracks do not
          hold up playback.
        </p>
      )}
      <label className="block">
        <span className="sr-only">Seek playback position</span>
        <input
          className="accent-accent w-full"
          aria-label="Seek playback position"
          type="range"
          min="0"
          max={duration}
          step="0.1"
          value={Math.min(time, duration)}
          onChange={(event) => controls.seekTo(Number(event.target.value))}
        />
      </label>
      <div
        ref={scrollRef}
        className="rounded-card border-subtle bg-surface-raised overflow-x-auto border p-2"
      >
        <Waveform renderTrackControls={renderTrackControls} />
      </div>
      <div
        ref={exportSectionRef}
        tabIndex={-1}
        className="rounded-card border-subtle bg-surface border p-5"
      >
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
            disabled={!mixerReady || isExporting || duration > 600}
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
  const initialManifest = useMemo(
    () => parseWorkspaceManifest(props.manifest),
    [props.manifest],
  );
  const workspaceAuthority =
    props.mode === "workspace" || props.mode === "contribution" ? props : null;
  const editable =
    props.mode === "workspace" ||
    (props.mode === "contribution" && props.canEdit)
      ? props
      : null;
  const [adapter, setAdapter] = useState(() =>
    createPreparedAdapter(initialManifest, props.viewerId),
  );
  const snapshot = useSyncExternalStore(
    adapter.subscribe,
    adapter.getSnapshot,
    adapter.getSnapshot,
  );
  const [message, setMessage] = useState("Requesting private audio access…");
  const [authorizationFailed, setAuthorizationFailed] = useState(false);
  const [trackMeta, setTrackMeta] = useState(props.tracks);
  const [autosave, dispatchAutosave] = useReducer(
    reduceAutosave,
    initialAutosaveState,
  );
  const [pendingManifest, setPendingManifest] =
    useState<WorkspaceManifestV1 | null>(null);
  const latestManifest = useRef<WorkspaceManifestV1 | null>(null);
  const [editGeneration, setEditGeneration] = useState(0);
  const generation = useRef(0);
  const acknowledgedGeneration = useRef(0);
  const [lifecycle] = useState(
    () =>
      new MutableStudioLifecycle({
        status: "saved",
        generation: 0,
        acknowledgedGeneration: 0,
        recoveryAvailable: false,
      }),
  );
  const lockVersion = useRef(editable?.lockVersion ?? 0);
  const baseRevisionId = useRef(editable?.baseRevisionId ?? "");
  const currentRevisionId = useRef(editable?.currentRevisionId ?? "");
  const saving = useRef(false);
  const dirtySince = useRef<number | null>(null);
  const autosaveStatus = useRef(autosave.status);
  const controller = useRef<AbortController | null>(null);
  const disposalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedMidiVersionId, setSelectedMidiVersionId] = useState("");
  const [importingMidi, setImportingMidi] = useState(false);
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
  const adapterMountMarked = useRef(false);
  const shellReadyMarked = useRef(false);
  const peaksReadyMarked = useRef(false);
  const playbackReadyMarked = useRef(false);
  useEffect(() => {
    if (!adapterMountMarked.current) {
      markStudioPerformance(studioPerformanceMarks.adapterMounted);
      adapterMountMarked.current = true;
    }
  }, []);
  useEffect(() => {
    const db = createSupabaseBrowserClient();
    const { data } = db.auth.onAuthStateChange((_event, session) => {
      if (!session || session.user.id !== props.viewerId)
        clearStudioSourceBufferRegistry();
    });
    return () => data.subscription.unsubscribe();
  }, [props.viewerId]);
  useEffect(() => {
    autosaveStatus.current = autosave.status;
  }, [autosave.status]);
  const initialAssetIds = useMemo(
    () => initialManifest.tracks.map((track) => track.assetId),
    [initialManifest],
  );

  const sourceEndpoint =
    props.mode === "revision"
      ? `/api/projects/${props.projectId}/revisions/${props.revisionId}/audio-sources`
      : props.mode === "contributionVersion"
        ? `/api/projects/${props.projectId}/contributions/${props.contributionId}/versions/${props.versionId}/audio-sources`
        : `/api/projects/${props.projectId}/workspaces/${props.workspaceId}/audio-sources`;
  const signLoad = useCallback(async (): Promise<SignedAudioSource[]> => {
    const response = await fetch(sourceEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        workspaceAuthority
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
  }, [initialAssetIds, sourceEndpoint, workspaceAuthority]);
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
      if (!editable) return false;
      const manifestSha256 = await sha256PostgresJsonb(manifest);
      return writeLocalRecovery({
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
    generation.current += 1;
    dirtySince.current ??= Date.now();
    latestManifest.current = manifest;
    setPendingManifest(manifest);
    setEditGeneration((value) => value + 1);
    dispatchAutosave({ type: "edit" });
    lifecycle.update({
      status: "dirty",
      generation: generation.current,
      acknowledgedGeneration: acknowledgedGeneration.current,
      recoveryAvailable: true,
    });
    void cachePending(manifest, "pending");
  }, [adapter, cachePending, lifecycle]);

  const performSave = useCallback(async () => {
    if (!editable || saving.current || autosave.status === "conflict") return;
    const manifest = latestManifest.current;
    if (!manifest) return;
    const saveGeneration = generation.current;
    if (!navigator.onLine) {
      dispatchAutosave({ type: "offline" });
      lifecycle.update({
        status: "offline",
        generation: generation.current,
        acknowledgedGeneration: acknowledgedGeneration.current,
        recoveryAvailable: await cachePending(manifest, "pending"),
      });
      return;
    }
    saving.current = true;
    dispatchAutosave({ type: "save" });
    lifecycle.update({
      status: "saving",
      generation: generation.current,
      acknowledgedGeneration: acknowledgedGeneration.current,
      recoveryAvailable: true,
    });
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
          lifecycle.update({
            status: "conflict",
            generation: generation.current,
            acknowledgedGeneration: acknowledgedGeneration.current,
            recoveryAvailable: await cachePending(manifest, "conflict"),
          });
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
          lifecycle.update({
            status: "conflict",
            generation: generation.current,
            acknowledgedGeneration: acknowledgedGeneration.current,
            recoveryAvailable: await cachePending(manifest, "conflict"),
          });
          return;
        }
        throw new Error(
          result.code === "invalid_state"
            ? "A track or snapshot changed. Review the draft and retry."
            : "The draft could not be saved. Retry when connected.",
        );
      }
      lockVersion.current = result.lockVersion;
      acknowledgedGeneration.current = Math.max(
        acknowledgedGeneration.current,
        saveGeneration,
      );
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
        lifecycle.update({
          status: "saved",
          generation: generation.current,
          acknowledgedGeneration: acknowledgedGeneration.current,
          recoveryAvailable: false,
        });
      } else {
        dispatchAutosave({ type: "edit" });
        setEditGeneration((value) => value + 1);
        lifecycle.update({
          status: "dirty",
          generation: generation.current,
          acknowledgedGeneration: acknowledgedGeneration.current,
          recoveryAvailable: await cachePending(
            latestManifest.current ?? manifest,
            "pending",
          ),
        });
      }
    } catch (error) {
      if (navigator.onLine) {
        dispatchAutosave({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "The draft could not be saved.",
        });
        lifecycle.update({
          status: "error",
          generation: generation.current,
          acknowledgedGeneration: acknowledgedGeneration.current,
          recoveryAvailable: await cachePending(manifest, "pending"),
        });
      } else {
        dispatchAutosave({ type: "offline" });
        lifecycle.update({
          status: "offline",
          generation: generation.current,
          acknowledgedGeneration: acknowledgedGeneration.current,
          recoveryAvailable: await cachePending(manifest, "pending"),
        });
      }
    } finally {
      saving.current = false;
    }
  }, [autosave.status, cachePending, editable, lifecycle]);

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
        dispatchAutosave({ type: "edit" });
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
        setAuthorizationFailed(false);
        const sources = await signLoad();
        await adapter.load({
          manifest: initialManifest,
          actorId: props.viewerId,
          sources,
          refreshSources: signLoad,
          signal: abort.signal,
        });
        const loaded = adapter.getSnapshot();
        setMessage(
          loaded.playbackReady
            ? editable
              ? "Playback ready. Draft edits autosave privately."
              : "Playback ready. Listening changes are session-only."
            : "Some tracks need attention before synchronized playback.",
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
        if (!abort.signal.aborted) {
          setAuthorizationFailed(true);
          setMessage(
            error instanceof Error ? error.message : "Studio could not open.",
          );
        }
      }
    })();
    return () => {
      window.removeEventListener("pagehide", pagehide);
      abort.abort();
      disposalTimer.current = setTimeout(() => void adapter.dispose(), 0);
    };
  }, [
    adapter,
    cachePending,
    editable,
    initialManifest,
    props.viewerId,
    signLoad,
  ]);

  const retryTrack = useCallback(
    async (trackId: string) => {
      const signal = controller.current?.signal;
      if (!signal || signal.aborted) return;
      setMessage("Refreshing private audio access for one track…");
      try {
        const sources = await signLoad();
        await adapter.retryTrack({
          trackId,
          actorId: props.viewerId,
          sources,
          refreshSources: signLoad,
          signal,
        });
        setMessage(
          adapter.getSnapshot().playbackReady
            ? "Playback ready."
            : "Track retry finished. Other audible tracks are still loading.",
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "This track could not be retried.",
        );
      }
    },
    [adapter, props.viewerId, signLoad],
  );

  const retryAuthorization = useCallback(async () => {
    const signal = controller.current?.signal;
    if (!signal || signal.aborted) return;
    setAuthorizationFailed(false);
    setMessage("Requesting private audio access…");
    try {
      const sources = await signLoad();
      await adapter.load({
        manifest: adapter.exportManifest(),
        actorId: props.viewerId,
        sources,
        refreshSources: signLoad,
        signal,
      });
      setMessage(
        adapter.getSnapshot().playbackReady
          ? "Playback ready."
          : "Some tracks need attention before synchronized playback.",
      );
    } catch (error) {
      setAuthorizationFailed(true);
      setMessage(
        error instanceof Error ? error.message : "Studio could not open.",
      );
    }
  }, [adapter, props.viewerId, signLoad]);

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

  const importMidiVersion = async () => {
    if (props.mode !== "workspace" || !selectedMidiVersionId) return;
    const version = props.midiVersions?.find(
      (candidate) => candidate.stemVersionId === selectedMidiVersionId,
    );
    if (!version) return;
    setImportingMidi(true);
    const upgradedManifest = mapManifestV1ToV2(initialManifest);
    const durationTicks = Math.max(
      upgradedManifest.durationTicks,
      version.durationTicks,
    );
    const next = parseWorkspaceManifestV2({
      ...upgradedManifest,
      timeSignature: {
        numerator: props.projectTimeSignature?.numerator ?? 4,
        denominator:
          ([1, 2, 4, 8, 16, 32] as const).find(
            (value) => value === props.projectTimeSignature?.denominator,
          ) ?? 4,
      },
      durationTicks,
      tracks: [
        ...upgradedManifest.tracks,
        {
          kind: "midi" as const,
          trackId: crypto.randomUUID(),
          name: version.name,
          instrumentId: null,
          presetId: version.defaultPresetId,
          presetVersion: version.defaultPresetVersion,
          gainDb: 0,
          pan: 0,
          muted: false,
          soloed: false,
          sortOrder: upgradedManifest.tracks.length,
          clips: [
            {
              clipId: crypto.randomUUID(),
              midiStemVersionId: version.stemVersionId,
              startTick: 0,
              durationTicks: version.durationTicks,
              sourceStartTick: 0,
              loop: false,
            },
          ],
        },
      ],
    } satisfies WorkspaceManifestV2);
    const result = await saveMidiWorkspaceAction({
      workspaceId: props.workspaceId,
      requestId: crypto.randomUUID(),
      expectedLockVersion: props.lockVersion,
      manifest: next,
    });
    if (!result.ok) {
      setImportingMidi(false);
      setMessage(
        result.code === "conflict"
          ? "This draft changed elsewhere. Reload before importing the MIDI version."
          : "That MIDI version could not be imported into this arrangement.",
      );
      return;
    }
    clearLocalRecovery(props.viewerId, props.workspaceId);
    location.reload();
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
              : result.code === "project_unavailable"
                ? "This project is not currently available for publishing."
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

  const shellReady = snapshot.manifest !== null && snapshot.tracks.length > 0;
  const readyTrackCount = snapshot.trackLoadStates.filter(
    (track) => track.status === "ready",
  ).length;
  const failedTrackCount = snapshot.trackLoadStates.filter(
    (track) => track.status === "failed",
  ).length;
  useEffect(() => {
    lifecycle.configure({
      requestSave: () => void performSave(),
      preserveRecovery: async () => {
        if (!latestManifest.current) return true;
        return cachePending(
          latestManifest.current,
          autosaveStatus.current === "conflict" ? "conflict" : "pending",
        );
      },
      dispose: async () => {
        controller.current?.abort();
        await adapter.dispose();
      },
    });
  }, [adapter, cachePending, lifecycle, performSave]);
  useStudioLifecycleRegistration(lifecycle, { editable: Boolean(editable) });

  const audioSummary = snapshot.playbackReady
    ? `Playback ready · ${readyTrackCount} of ${snapshot.trackLoadStates.length} tracks decoded`
    : failedTrackCount > 0
      ? `${readyTrackCount} of ${snapshot.trackLoadStates.length} tracks ready · ${failedTrackCount} need attention`
      : `${readyTrackCount} of ${snapshot.trackLoadStates.length} tracks ready · loading audio`;
  useEffect(() => {
    if (!shellReady || shellReadyMarked.current) return;
    shellReadyMarked.current = true;
    markStudioPerformance(studioPerformanceMarks.shellReady);
  }, [shellReady]);
  useEffect(() => {
    if (snapshot.waveformsReady) {
      if (peaksReadyMarked.current) return;
      peaksReadyMarked.current = true;
      markStudioPerformance(studioPerformanceMarks.peaksReady);
    }
  }, [snapshot.waveformsReady]);
  useEffect(() => {
    if (snapshot.playbackReady && !playbackReadyMarked.current) {
      playbackReadyMarked.current = true;
      markStudioPerformance(studioPerformanceMarks.playbackReady);
    }
  }, [snapshot.playbackReady]);
  const addedAssetIds = new Set(
    snapshot.manifest?.tracks.map((track) => track.assetId) ?? [],
  );
  return (
    <section className="space-y-6">
      {props.mode === "contribution" && (
        <div className="rounded-card border-subtle border p-4">
          <p className="text-accent font-semibold">
            Contribution: {props.contributionTitle}
          </p>
          <p className="text-muted mt-1 text-sm">
            Status: {props.contributionStatus.replace("_", " ")} Â· Based on
            revision {props.currentRevisionNumber}
          </p>
          <Link
            className="mt-2 inline-flex underline"
            href={
              "/projects/" +
              props.projectId +
              "/contributions/" +
              props.contributionId
            }
          >
            Return to contribution
          </Link>
          {!props.canEdit && (
            <p className="mt-3 font-semibold">
              This submitted or terminal contribution is read-only.
            </p>
          )}
        </div>
      )}
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
          <span className="text-muted block text-sm">
            Audio: {audioSummary}
          </span>
        )}
        {!editable && (
          <span className="text-muted block text-sm">{audioSummary}</span>
        )}
        {authorizationFailed && (
          <button
            type="button"
            className={`${studioBtnGhost} mt-3`}
            onClick={() => void retryAuthorization()}
          >
            Retry private audio access
          </button>
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
      {!shellReady ? (
        <button
          type="button"
          className="rounded-control border-strong min-h-11 border px-5"
          onClick={() => {
            controller.current?.abort();
            setAdapter(createPreparedAdapter(initialManifest, props.viewerId));
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
                  className={studioBtnPrimary}
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
            {props.mode === "workspace" &&
              Boolean(props.midiVersions?.length) && (
                <div className="rounded-card border-subtle bg-surface flex flex-wrap items-end gap-3 border p-5">
                  <label className="min-w-64 flex-1">
                    Add an immutable MIDI version from My stems
                    <select
                      className="border-subtle mt-1 block min-h-11 w-full border px-3"
                      value={selectedMidiVersionId}
                      onChange={(event) =>
                        setSelectedMidiVersionId(event.target.value)
                      }
                    >
                      <option value="">Choose a MIDI version</option>
                      {props.midiVersions?.map((version) => (
                        <option
                          key={version.stemVersionId}
                          value={version.stemVersionId}
                        >
                          {version.name} - v{version.version} -{" "}
                          {version.creatorCreditName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className={studioBtnPrimary}
                    disabled={!selectedMidiVersionId || importingMidi}
                    onClick={() => void importMidiVersion()}
                  >
                    {importingMidi ? "Importing..." : "Import exact version"}
                  </button>
                  <Link className="min-h-11 py-2 underline" href="/stems">
                    Open My stems
                  </Link>
                </div>
              )}
            <WaveformPlaylistProvider
              tracks={snapshot.tracks}
              timescale
              theme={studioTheme}
              controls={{ show: true, width: 232 }}
              waveHeight={editable ? 140 : 104}
              samplesPerPixel={512}
              zoomLevels={[128, 256, 512, 1024, 2048]}
              automaticScroll
              deferEngineRebuild={!snapshot.playbackReady}
              onError={() =>
                setMessage(
                  "The playback engine could not start. Retry the studio.",
                )
              }
              onTracksChange={(tracks) => adapter.acceptEditorTracks(tracks)}
            >
              <PlaybackControls
                adapter={adapter}
                snapshot={snapshot}
                tracks={trackMeta}
                editable={editable}
                onEdited={markEdited}
                onRetryTrack={(trackId) => void retryTrack(trackId)}
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
              className={studioBtnGhost}
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
          {props.mode === "workspace" && (
            <section className="rounded-card border-strong border p-5">
              <h2 className="font-bold">Publish saved workspace</h2>
              <p className="text-muted mt-1 text-sm">
                Publishing creates a new immutable revision. It never changes
                the previous revision.
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
                className={`${studioBtnPrimary} mt-4`}
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
                  Revision {publishState.revisionNumber} published. This
                  workspace now continues from it.
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
          )}
        </div>
      ) : (
        <p className="text-muted text-sm">
          Listening changes are session-only.
        </p>
      )}
      <StemDownloadPanel
        endpoint={
          props.mode === "revision"
            ? `/api/projects/${props.projectId}/revisions/${props.revisionId}/downloads/stems`
            : props.mode === "contributionVersion"
              ? `/api/projects/${props.projectId}/contributions/${props.contributionId}/versions/${props.versionId}/downloads/stems`
              : `/api/projects/${props.projectId}/workspaces/${props.workspaceId}/downloads/stems`
        }
        assetIds={snapshot.manifest?.tracks.map((track) => track.assetId) ?? []}
        disabled={Boolean(editable && autosave.status !== "saved")}
      />
    </section>
  );
}
