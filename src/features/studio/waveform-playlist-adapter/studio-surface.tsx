"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Waveform,
  WaveformPlaylistProvider,
  usePlaylistControls,
  usePlaylistData,
} from "@waveform-playlist/browser";
import { useExportWav } from "@waveform-playlist/browser/tone";
import { resumeGlobalAudioContext } from "@waveform-playlist/playout";
import type { WorkspaceManifestV1 } from "../manifest/schema";
import { parseVersionedWorkspaceManifest } from "../manifest/schema";
import type { StudioAssetSource } from "../studio-adapter.types";
import { WaveformPlaylistStudioAdapter } from "./adapter.client";

const STORAGE_KEY = "jam-session:studio-spike:manifest-v1";

function RuntimeBridge({
  adapter,
}: {
  adapter: WaveformPlaylistStudioAdapter;
}) {
  const controls = usePlaylistControls();
  const { trackStates } = usePlaylistData();
  const { exportWav } = useExportWav();

  useEffect(() => {
    adapter.attachRuntime({
      play: async () => {
        await resumeGlobalAudioContext();
        await controls.play();
      },
      pause: controls.pause,
      seek: controls.seekTo,
      renderMix: async (tracks) => (await exportWav(tracks, trackStates)).blob,
    });
    return () => adapter.attachRuntime(null);
  }, [adapter, controls, exportWav, trackStates]);
  return null;
}

export function StudioSurface({
  initialManifest,
  assets,
}: {
  initialManifest: WorkspaceManifestV1;
  assets: readonly StudioAssetSource[];
}) {
  const adapter = useMemo(() => new WaveformPlaylistStudioAdapter(), []);
  const snapshot = useSyncExternalStore(
    adapter.subscribe,
    adapter.getSnapshot,
    adapter.getSnapshot,
  );
  const [message, setMessage] = useState("Audio is not loaded.");
  const [seekSeconds, setSeekSeconds] = useState(0);
  const loadStarted = useRef(false);
  const disposalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (disposalTimer.current) clearTimeout(disposalTimer.current);
    const cleanup = () => void adapter.dispose();
    window.addEventListener("pagehide", cleanup);
    if (!loadStarted.current) {
      loadStarted.current = true;
      void (async () => {
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          const manifest = stored
            ? parseVersionedWorkspaceManifest(JSON.parse(stored))
            : initialManifest;
          await adapter.load({ manifest, assets });
          setMessage("Ready. Audio was fetched only after this open action.");
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Could not open the studio.",
          );
        }
      })();
    }
    return () => {
      window.removeEventListener("pagehide", cleanup);
      // A zero-delay grace period survives React Strict Mode's setup/cleanup/setup probe.
      disposalTimer.current = setTimeout(cleanup, 0);
    };
  }, [adapter, assets, initialManifest]);

  async function exportWav() {
    try {
      const blob = await adapter.renderMix();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "jam-session-spike.wav";
      link.click();
      URL.revokeObjectURL(url);
      setMessage(`Exported a ${blob.size.toLocaleString()} byte WAV.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export failed.");
    }
  }

  function persist() {
    const manifest = adapter.exportManifest();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(manifest));
    setMessage(
      "Manifest v1 saved locally. Hard refresh and reopen to verify restoration.",
    );
  }

  async function addTrack() {
    await adapter.addAudioAsset({
      asset: { assetId: "asset-pulse-copy", url: assets[0].url },
      track: {
        trackId: "track-pulse-copy",
        assetId: "asset-pulse-copy",
        name: "Pulse copy",
        positionMs: 1000,
        trimStartMs: 0,
        durationMs: 1000,
        gainDb: -9,
        pan: 0,
        muted: false,
        soloed: false,
        sortOrder: snapshot.manifest?.tracks.length ?? 2,
      },
    });
    setMessage(
      "Added a third logical track with stable fake asset and track IDs.",
    );
  }

  const ready = ["ready", "playing", "paused"].includes(snapshot.status);
  return (
    <section className="space-y-6" aria-labelledby="studio-heading">
      <div>
        <p className="text-accent text-sm font-semibold tracking-widest uppercase">
          Architecture spike
        </p>
        <h1 id="studio-heading" className="mt-2 text-3xl font-bold">
          Waveform Playlist studio boundary
        </h1>
        <p className="text-muted mt-3 max-w-3xl">
          This removable route proves deterministic manifest hydration, mixer
          edits, timeline positioning, synchronized playback, and WAV export.
        </p>
      </div>

      <div
        className="rounded-card border-subtle bg-surface p-5"
        aria-live="polite"
      >
        <p>
          <strong>Status:</strong> {snapshot.status}
        </p>
        <p className="text-muted mt-1">{message}</p>
      </div>

      {!ready ? (
        <p role="status">
          {snapshot.status === "error"
            ? "Studio failed to open."
            : "Opening studio and decoding fixtures…"}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void adapter.play()}
              className="rounded-control bg-accent text-accent-contrast min-h-11 px-4 font-semibold"
            >
              Play
            </button>
            <button
              type="button"
              onClick={() => adapter.pause()}
              className="rounded-control border-strong bg-surface min-h-11 border px-4"
            >
              Pause
            </button>
            <label className="flex min-h-11 items-center gap-2">
              <span>Seek (seconds)</span>
              <input
                aria-label="Seek seconds"
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={seekSeconds}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setSeekSeconds(value);
                  adapter.seek(value);
                }}
              />
            </label>
            <button
              type="button"
              onClick={persist}
              className="rounded-control border-strong bg-surface min-h-11 border px-4"
            >
              Save manifest
            </button>
            <button
              type="button"
              onClick={() => void exportWav()}
              className="rounded-control border-strong bg-surface min-h-11 border px-4"
            >
              Export WAV
            </button>
            {snapshot.tracks.length < 3 && (
              <button
                type="button"
                onClick={() => void addTrack()}
                className="rounded-control border-strong bg-surface min-h-11 border px-4"
              >
                Add fixture track
              </button>
            )}
          </div>

          <div className="rounded-card border-subtle bg-surface-raised overflow-x-auto border p-3">
            <WaveformPlaylistProvider
              tracks={snapshot.tracks}
              onTracksChange={(tracks) => adapter.acceptEditorTracks(tracks)}
              timescale
              controls={{ show: false, width: 0 }}
              waveHeight={96}
              samplesPerPixel={512}
            >
              <RuntimeBridge adapter={adapter} />
              <Waveform />
            </WaveformPlaylistProvider>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {snapshot.manifest?.tracks.map((track) => (
              <fieldset
                key={track.trackId}
                className="rounded-card border-subtle bg-surface space-y-3 border p-4"
              >
                <legend className="px-2 font-semibold">
                  {track.name}{" "}
                  <span className="text-muted text-xs">{track.trackId}</span>
                </legend>
                <label className="block">
                  Gain dB{" "}
                  <input
                    className="w-full"
                    type="range"
                    min="-60"
                    max="6"
                    step="1"
                    value={track.gainDb}
                    onChange={(e) =>
                      adapter.updateTrack(track.trackId, {
                        gainDb: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="block">
                  Pan{" "}
                  <input
                    className="w-full"
                    type="range"
                    min="-1"
                    max="1"
                    step="0.1"
                    value={track.pan}
                    onChange={(e) =>
                      adapter.updateTrack(track.trackId, {
                        pan: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="block">
                  Position ms{" "}
                  <input
                    className="w-full"
                    type="range"
                    min="0"
                    max="2000"
                    step="100"
                    value={track.positionMs}
                    onChange={(e) =>
                      adapter.updateTrack(track.trackId, {
                        positionMs: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="mr-4">
                  <input
                    type="checkbox"
                    checked={track.muted}
                    onChange={(e) =>
                      adapter.updateTrack(track.trackId, {
                        muted: e.target.checked,
                      })
                    }
                  />{" "}
                  Mute
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={track.soloed}
                    onChange={(e) =>
                      adapter.updateTrack(track.trackId, {
                        soloed: e.target.checked,
                      })
                    }
                  />{" "}
                  Solo
                </label>
              </fieldset>
            ))}
          </div>
          <details>
            <summary>Serialized manifest</summary>
            <pre className="mt-2 overflow-auto text-xs">
              {JSON.stringify(adapter.exportManifest(), null, 2)}
            </pre>
          </details>
        </>
      )}
    </section>
  );
}
