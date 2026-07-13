"use client";

import {
  useCallback,
  useEffect,
  useMemo,
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
import { resumeGlobalAudioContext } from "@waveform-playlist/playout";
import type { WorkspaceManifestV1 } from "../manifest/schema";
import type { SignedAudioSource } from "../source-contract";
import { StudioAdapterError } from "../studio-adapter.types";
import { WaveformPlaylistStudioAdapter } from "./adapter.client";

type TrackMeta = {
  trackId: string;
  instrumentName: string | null;
  creditName: string;
};

const formatTime = (seconds: number) => {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${Math.floor(safe % 60)
    .toString()
    .padStart(2, "0")}`;
};

function PlaybackControls({
  adapter,
  duration,
  tracks,
}: {
  adapter: WaveformPlaylistStudioAdapter;
  duration: number;
  tracks: TrackMeta[];
}) {
  const controls = usePlaylistControls();
  const data = usePlaylistData();
  const { isPlaying } = usePlaybackAnimation();
  const [time, setTime] = useState(0);
  const [audioIssue, setAudioIssue] = useState(false);
  const attemptPlay = useCallback(async () => {
    try {
      await adapter.play();
      setAudioIssue(false);
    } catch {
      setAudioIssue(true);
    }
  }, [adapter]);
  useEffect(() => {
    adapter.attachRuntime({
      play: async () => {
        await resumeGlobalAudioContext();
        await controls.play();
      },
      pause: controls.pause,
      seek: controls.seekTo,
      renderMix: async () => {
        throw new Error("read_only");
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
  }, [adapter, controls, data.playoutRef]);
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
            onChange={(e) => controls.seekTo(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="rounded-card border-subtle bg-surface-raised overflow-x-auto border p-3">
        <Waveform />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {data.tracks.map((track, index) => {
          const meta = tracks.find((item) => item.trackId === track.id);
          const current = data.trackStates[index]!;
          return (
            <fieldset
              key={track.id}
              className="rounded-card border-subtle bg-surface space-y-4 border p-4"
            >
              <legend className="px-2 font-semibold">{track.name}</legend>
              <p className="text-muted text-sm">
                {meta?.instrumentName ?? "No instrument"} ·{" "}
                {meta?.creditName ?? "Unknown creator"}
              </p>
              <label className="block">
                Gain{" "}
                <span className="text-muted">
                  {Math.round(current.volume * 100)}%
                </span>
                <input
                  aria-label={`${track.name} gain`}
                  className="w-full"
                  type="range"
                  min="0"
                  max="2"
                  step="0.01"
                  value={current.volume}
                  onChange={(e) =>
                    controls.setTrackVolume(index, Number(e.target.value))
                  }
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
                  onChange={(e) =>
                    controls.setTrackPan(index, Number(e.target.value))
                  }
                />
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  aria-pressed={current.muted}
                  className="rounded-control border-strong min-h-11 border px-4"
                  onClick={() => controls.setTrackMute(index, !current.muted)}
                >
                  {current.muted ? "Muted" : "Mute"}
                </button>
                <button
                  type="button"
                  aria-pressed={current.soloed}
                  className="rounded-control border-strong min-h-11 border px-4"
                  onClick={() => controls.setTrackSolo(index, !current.soloed)}
                >
                  {current.soloed ? "Soloed" : "Solo"}
                </button>
              </div>
            </fieldset>
          );
        })}
      </div>
    </>
  );
}

export function StudioSurface({
  projectId,
  revisionId,
  manifest,
  durationMs,
  tracks,
}: {
  projectId: string;
  revisionId: string;
  manifest: WorkspaceManifestV1;
  durationMs: number;
  tracks: TrackMeta[];
}) {
  const [adapter, setAdapter] = useState(
    () => new WaveformPlaylistStudioAdapter(),
  );
  const snapshot = useSyncExternalStore(
    adapter.subscribe,
    adapter.getSnapshot,
    adapter.getSnapshot,
  );
  const [message, setMessage] = useState("Requesting private audio access…");
  const controller = useRef<AbortController | null>(null);
  const disposalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assetIds = useMemo(
    () => manifest.tracks.map((track) => track.assetId),
    [manifest],
  );
  const sign = useCallback(async (): Promise<SignedAudioSource[]> => {
    const response = await fetch(
      `/api/projects/${projectId}/revisions/${revisionId}/audio-sources`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetIds }),
        cache: "no-store",
      },
    );
    if (!response.ok)
      throw new StudioAdapterError(
        response.status === 401 ? "unauthorized_source" : "fetch_failed",
        response.status === 401
          ? "Sign in again to access this audio."
          : "Private audio access is unavailable. Retry the studio.",
      );
    const value = (await response.json()) as { sources: SignedAudioSource[] };
    return value.sources;
  }, [assetIds, projectId, revisionId]);
  useEffect(() => {
    if (disposalTimer.current) clearTimeout(disposalTimer.current);
    const abort = new AbortController();
    controller.current = abort;
    const pagehide = () => {
      abort.abort();
      void adapter.dispose();
    };
    window.addEventListener("pagehide", pagehide);
    void (async () => {
      try {
        const sources = await sign();
        await adapter.load({
          manifest,
          sources,
          refreshSources: sign,
          signal: abort.signal,
          onProgress: (loaded, total) =>
            setMessage(`Loading ${loaded} of ${total} stems`),
        });
        setMessage("Ready. Listening changes are session-only.");
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
  }, [adapter, manifest, sign]);
  const ready = ["ready", "playing", "paused"].includes(snapshot.status);
  return (
    <section className="space-y-6">
      <div
        aria-live="polite"
        className="rounded-control border-subtle bg-surface border p-4"
      >
        <strong>Status:</strong> {message}
      </div>
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
          <WaveformPlaylistProvider
            tracks={snapshot.tracks}
            timescale
            controls={{ show: false, width: 0 }}
            waveHeight={96}
            samplesPerPixel={512}
          >
            <PlaybackControls
              adapter={adapter}
              duration={durationMs / 1000}
              tracks={tracks}
            />
          </WaveformPlaylistProvider>
        )
      )}
      <p className="text-muted text-sm">Listening changes are session-only.</p>
    </section>
  );
}
