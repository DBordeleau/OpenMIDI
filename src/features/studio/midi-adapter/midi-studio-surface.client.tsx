"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StudioLauncherProps } from "../components/studio-launcher.client";
import {
  MIDI_PPQ,
  parseWorkspaceManifestV2,
  type MidiTrackV2,
  type WorkspaceManifestV2,
  type WorkspaceTrackV2,
} from "../manifest/v2";
import { BrowserMidiRuntime } from "./browser-midi-runtime.client";
import { projectMidiSchedule } from "@/features/midi/scheduler";
import { SYNTH_PRESETS_V1 } from "@/features/midi/presets";
import {
  exportMidiProject,
  renderMidiProjectWav,
} from "@/features/midi/project-export.client";
import { sanitizeFilenamePart } from "@/features/exports/filename";
import type { SignedAudioSource } from "@/features/studio/source-contract";
import {
  publishMidiWorkspaceAction,
  saveMidiWorkspaceAction,
} from "@/features/workspaces/actions";

type Props = StudioLauncherProps & { manifest: WorkspaceManifestV2 };
type SaveStatus = "saved" | "dirty" | "saving" | "conflict" | "error";

const button =
  "border-strong hover:border-accent inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-semibold disabled:opacity-50";
const input =
  "border-strong bg-canvas min-h-11 rounded-control border px-3 text-sm";

export function MidiStudioSurface(props: Props) {
  const midiVersions = useMemo(
    () => props.midiVersions ?? [],
    [props.midiVersions],
  );
  const editable =
    props.mode === "workspace" ||
    (props.mode === "contribution" && props.canEdit);
  const [manifest, setManifest] = useState(props.manifest);
  const [lockVersion, setLockVersion] = useState(
    editable ? props.lockVersion : 0,
  );
  const [baseRevisionId, setBaseRevisionId] = useState(
    editable ? props.baseRevisionId : null,
  );
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [message, setMessage] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState(
    midiVersions[0]?.stemVersionId ?? "",
  );
  const [playing, setPlaying] = useState(false);
  const [seekTick, setSeekTick] = useState(0);
  const [rendering, setRendering] = useState(false);
  const runtime = useRef<BrowserMidiRuntime | null>(null);
  const playbackTimer = useRef<number | null>(null);
  const stemVersions = useMemo(
    () =>
      new Map(midiVersions.map((version) => [version.stemVersionId, version])),
    [midiVersions],
  );

  useEffect(() => {
    const next = new BrowserMidiRuntime();
    const controller = new AbortController();
    runtime.current = next;
    try {
      const schedule = projectMidiSchedule({ manifest, stemVersions });
      void (async () => {
        await next.prepare(schedule);
        const sources = await loadAudioSources(
          props,
          manifest,
          controller.signal,
        );
        await next.prepareAudio(manifest, sources, controller.signal);
      })().catch(() =>
        setMessage("The local Studio instruments could not be prepared."),
      );
    } catch {
      // Draft timing is validated and reported by the explicit save/play action.
    }
    return () => {
      controller.abort();
      if (playbackTimer.current) clearTimeout(playbackTimer.current);
      next.dispose();
      if (runtime.current === next) runtime.current = null;
    };
  }, [manifest, props, stemVersions]);

  useEffect(() => {
    const pauseForOtherPlayer = (event: Event) => {
      const instanceId = (event as CustomEvent<{ instanceId?: string }>).detail
        ?.instanceId;
      if (instanceId !== `studio:${props.projectId}`) {
        runtime.current?.pause();
        setPlaying(false);
      }
    };
    window.addEventListener("jam-session:preview-play", pauseForOtherPlayer);
    return () =>
      window.removeEventListener(
        "jam-session:preview-play",
        pauseForOtherPlayer,
      );
  }, [props.projectId]);

  const changeManifest = (next: WorkspaceManifestV2) => {
    setManifest(next);
    setStatus("dirty");
    setMessage(null);
  };

  async function persist(next = manifest) {
    if (!editable) return false;
    let canonical: WorkspaceManifestV2;
    try {
      canonical = parseWorkspaceManifestV2(next);
    } catch {
      setStatus("error");
      setMessage("Check clip timing and mixer values before saving.");
      return false;
    }
    setStatus("saving");
    const result = await saveMidiWorkspaceAction({
      workspaceId: props.workspaceId,
      requestId: crypto.randomUUID(),
      expectedLockVersion: lockVersion,
      manifest: canonical,
    });
    if (!result.ok) {
      setStatus(result.code === "conflict" ? "conflict" : "error");
      setMessage(
        result.code === "conflict"
          ? "This workspace changed in another session. Reload before replacing an exact stem version."
          : "The arrangement could not be saved.",
      );
      return false;
    }
    setManifest(canonical);
    setLockVersion(result.lockVersion);
    setStatus("saved");
    setMessage("Arrangement saved.");
    return true;
  }

  async function importVersion() {
    const version = stemVersions.get(selectedVersionId);
    if (!version || !editable || manifest.tracks.length >= 16) return;
    const trackId = crypto.randomUUID();
    const track: MidiTrackV2 = {
      kind: "midi",
      trackId,
      name: version.name,
      instrumentId: null,
      presetId: version.defaultPresetId,
      presetVersion: version.defaultPresetVersion,
      gainDb: 0,
      pan: 0,
      muted: false,
      soloed: false,
      sortOrder: manifest.tracks.length,
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
    };
    const next = parseWorkspaceManifestV2({
      ...manifest,
      durationTicks: Math.max(manifest.durationTicks, version.durationTicks),
      tracks: [...manifest.tracks, track],
    });
    changeManifest(next);
    await persist(next);
  }

  async function replaceVersion(trackId: string, stemVersionId: string) {
    const version = stemVersions.get(stemVersionId);
    if (!version || !editable) return;
    const next = parseWorkspaceManifestV2({
      ...manifest,
      durationTicks: Math.max(manifest.durationTicks, version.durationTicks),
      tracks: manifest.tracks.map((track) =>
        track.trackId !== trackId || track.kind !== "midi"
          ? track
          : {
              ...track,
              name: version.name,
              presetId: version.defaultPresetId,
              presetVersion: version.defaultPresetVersion,
              clips: track.clips.map((clip, index) =>
                index === 0
                  ? {
                      ...clip,
                      midiStemVersionId: version.stemVersionId,
                      durationTicks: Math.min(
                        clip.durationTicks,
                        version.durationTicks,
                      ),
                      sourceStartTick: 0,
                    }
                  : clip,
              ),
            },
      ),
    });
    changeManifest(next);
    await persist(next);
  }

  function updateTrack(trackId: string, patch: Partial<WorkspaceTrackV2>) {
    changeManifest({
      ...manifest,
      tracks: manifest.tracks.map((track) =>
        track.trackId === trackId
          ? ({ ...track, ...patch } as WorkspaceTrackV2)
          : track,
      ),
    });
  }

  function removeTrack(trackId: string) {
    changeManifest({
      ...manifest,
      tracks: manifest.tracks
        .filter((track) => track.trackId !== trackId)
        .map((track, sortOrder) => ({ ...track, sortOrder })),
    });
  }

  async function togglePlayback() {
    if (playing) {
      runtime.current?.pause();
      if (playbackTimer.current) clearTimeout(playbackTimer.current);
      setPlaying(false);
      return;
    }
    window.dispatchEvent(
      new CustomEvent("jam-session:preview-play", {
        detail: { instanceId: `studio:${props.projectId}` },
      }),
    );
    try {
      const fromSeconds = (seekTick * 60) / (manifest.tempoBpm * MIDI_PPQ);
      await runtime.current?.play(fromSeconds);
      setPlaying(true);
      const duration =
        ((manifest.durationTicks - seekTick) * 60_000) /
        (manifest.tempoBpm * MIDI_PPQ);
      playbackTimer.current = window.setTimeout(() => {
        setPlaying(false);
        setSeekTick(0);
      }, duration);
    } catch {
      setMessage("Playback needs an enabled browser audio context.");
    }
  }

  function download(bytes: Uint8Array | Blob, extension: "mid" | "wav") {
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart]);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizeFilenamePart(props.projectTitle, "jam-session")}.${extension}`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function publish() {
    if (
      props.mode !== "workspace" ||
      status !== "saved" ||
      manifest.tracks.length === 0
    )
      return;
    setMessage("Publishing immutable revision…");
    const result = await publishMidiWorkspaceAction(props.projectId, {
      workspaceId: props.workspaceId,
      requestId: crypto.randomUUID(),
      expectedLockVersion: lockVersion,
      expectedBaseRevisionId: baseRevisionId,
      message: null,
    });
    if (!result.ok) {
      setMessage(
        "The revision could not be published. Reload if the project changed.",
      );
      return;
    }
    setLockVersion(result.workspaceLockVersion);
    setBaseRevisionId(result.revisionId);
    setMessage(
      `Revision ${result.revisionNumber} published with exact MIDI stem references.`,
    );
  }

  return (
    <section className="rounded-card border-strong bg-surface space-y-6 border p-5 sm:p-7">
      {props.mode === "contribution" && (
        <div className="border-subtle rounded-control border p-4">
          <p className="font-semibold">
            Contribution: {props.contributionTitle}
          </p>
          <p className="text-muted mt-1 text-sm">
            Replace exact stem versions here, then return to the contribution to
            submit an immutable snapshot.
          </p>
          <Link
            className="text-accent mt-2 inline-block underline"
            href={`/projects/${props.projectId}/contributions/${props.contributionId}`}
          >
            Return to contribution
          </Link>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-accent font-mono text-xs uppercase">
            Composite MIDI Studio
          </p>
          <h2 className="mt-1 text-2xl font-semibold">Arrangement</h2>
          <p className="text-muted mt-1 text-sm">
            Stem notes are immutable here. Arrange, mix, or explicitly replace
            an exact version.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={button}
            type="button"
            onClick={() => void togglePlayback()}
            disabled={!manifest.tracks.length}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <button
            className={button}
            type="button"
            disabled={!manifest.tracks.length}
            onClick={() =>
              download(
                exportMidiProject(manifest, stemVersions, props.projectTitle),
                "mid",
              )
            }
          >
            Export .mid
          </button>
          <button
            className={button}
            type="button"
            disabled={!manifest.tracks.length || rendering}
            onClick={() =>
              void (async () => {
                setRendering(true);
                try {
                  download(
                    await renderMidiProjectWav(
                      manifest,
                      stemVersions,
                      await loadAudioSources(
                        props,
                        manifest,
                        new AbortController().signal,
                      ),
                    ),
                    "wav",
                  );
                } catch {
                  setMessage(
                    "The local synth mix could not be rendered in this browser.",
                  );
                } finally {
                  setRendering(false);
                }
              })()
            }
          >
            {rendering ? "Rendering…" : "Export synth WAV"}
          </button>
        </div>
      </div>

      <label className="block text-sm font-semibold">
        Start playback at tick {seekTick}
        <input
          className="accent-accent mt-2 block w-full"
          type="range"
          min={0}
          max={manifest.durationTicks}
          step={MIDI_PPQ / 4}
          value={seekTick}
          onChange={(event) => setSeekTick(Number(event.target.value))}
        />
      </label>

      {editable && (
        <div className="rounded-control border-subtle bg-surface-soft flex flex-wrap items-end gap-3 border p-4">
          <label className="min-w-64 flex-1 text-sm font-semibold">
            Immutable version from My stems
            <select
              className={`${input} mt-2 w-full`}
              value={selectedVersionId}
              onChange={(event) => setSelectedVersionId(event.target.value)}
            >
              {midiVersions.map((version) => (
                <option
                  key={version.stemVersionId}
                  value={version.stemVersionId}
                >
                  {version.name} · v{version.version} ·{" "}
                  {version.creatorCreditName}
                </option>
              ))}
            </select>
          </label>
          <button
            className={button}
            type="button"
            onClick={() => void importVersion()}
            disabled={!selectedVersionId || status === "saving"}
          >
            Import exact version
          </button>
          <Link className={button} href="/stems">
            Open My stems
          </Link>
        </div>
      )}

      {manifest.tracks.length === 0 ? (
        <div className="border-strong rounded-control border border-dashed p-8 text-center">
          <h3 className="text-xl font-semibold">
            Bring in your first MIDI part.
          </h3>
          <p className="text-muted mt-2">
            Save a version in My stems, then import that exact immutable take
            here.
          </p>
        </div>
      ) : (
        <ol className="space-y-4">
          {manifest.tracks.map((track) => {
            if (track.kind === "audio") {
              const clip = track.clips[0]!;
              return (
                <li
                  key={track.trackId}
                  className="rounded-control border-subtle grid gap-4 border p-4 lg:grid-cols-[1fr_2fr]"
                >
                  <div>
                    <p className="font-semibold">
                      {track.sortOrder + 1}. {track.name}
                    </p>
                    <p className="text-muted mt-1 text-sm">
                      Private legacy audio - mixed locally with MIDI
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-xs font-semibold">
                      Gain dB
                      <input
                        className={`${input} mt-1 w-full`}
                        type="number"
                        min={-60}
                        max={6}
                        step={0.5}
                        disabled={!editable}
                        value={track.gainDb}
                        onChange={(event) =>
                          updateTrack(track.trackId, {
                            gainDb: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="text-xs font-semibold">
                      Pan
                      <input
                        className={`${input} mt-1 w-full`}
                        type="number"
                        min={-1}
                        max={1}
                        step={0.1}
                        disabled={!editable}
                        value={track.pan}
                        onChange={(event) =>
                          updateTrack(track.trackId, {
                            pan: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="text-xs font-semibold">
                      Start ms
                      <input
                        className={`${input} mt-1 w-full`}
                        type="number"
                        min={0}
                        disabled={!editable}
                        value={clip.positionMs}
                        onChange={(event) =>
                          updateTrack(track.trackId, {
                            clips: [
                              {
                                ...clip,
                                positionMs: Number(event.target.value),
                              },
                            ],
                          })
                        }
                      />
                    </label>
                    <label className="text-xs font-semibold">
                      Length ms
                      <input
                        className={`${input} mt-1 w-full`}
                        type="number"
                        min={1}
                        disabled={!editable}
                        value={clip.durationMs}
                        onChange={(event) =>
                          updateTrack(track.trackId, {
                            clips: [
                              {
                                ...clip,
                                durationMs: Number(event.target.value),
                              },
                            ],
                          })
                        }
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={track.muted}
                        disabled={!editable}
                        onChange={(event) =>
                          updateTrack(track.trackId, {
                            muted: event.target.checked,
                          })
                        }
                      />
                      Mute
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={track.soloed}
                        disabled={!editable}
                        onChange={(event) =>
                          updateTrack(track.trackId, {
                            soloed: event.target.checked,
                          })
                        }
                      />
                      Solo
                    </label>
                    {editable && (
                      <button
                        className="text-danger text-left text-sm underline"
                        type="button"
                        onClick={() => removeTrack(track.trackId)}
                      >
                        Remove track
                      </button>
                    )}
                  </div>
                </li>
              );
            }
            const clip = track.clips[0]!;
            const version = stemVersions.get(clip.midiStemVersionId);
            return (
              <li
                key={track.trackId}
                className="rounded-control border-subtle grid gap-4 border p-4 lg:grid-cols-[1fr_2fr]"
              >
                <div>
                  <p className="font-semibold">
                    {track.sortOrder + 1}. {track.name}
                  </p>
                  <p className="text-muted mt-1 text-sm">
                    {version?.creatorCreditName ?? "Unknown creator"} · exact
                    version {version?.version ?? "—"}
                  </p>
                  {editable && (
                    <select
                      aria-label={`Replace ${track.name} version`}
                      className={`${input} mt-3 w-full`}
                      value={clip.midiStemVersionId}
                      onChange={(event) =>
                        void replaceVersion(track.trackId, event.target.value)
                      }
                    >
                      {midiVersions.map((candidate) => (
                        <option
                          key={candidate.stemVersionId}
                          value={candidate.stemVersionId}
                        >
                          {candidate.name} · v{candidate.version}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-xs font-semibold">
                    Preset
                    <select
                      className={`${input} mt-1 w-full`}
                      disabled={!editable}
                      value={`${track.presetId}:${track.presetVersion}`}
                      onChange={(event) => {
                        const [presetId, presetVersion] =
                          event.target.value.split(":");
                        updateTrack(track.trackId, {
                          presetId,
                          presetVersion: Number(presetVersion),
                        });
                      }}
                    >
                      {SYNTH_PRESETS_V1.map((preset) => (
                        <option
                          key={`${preset.presetId}:${preset.version}`}
                          value={`${preset.presetId}:${preset.version}`}
                        >
                          {preset.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold">
                    Gain dB
                    <input
                      className={`${input} mt-1 w-full`}
                      type="number"
                      min={-60}
                      max={6}
                      step={0.5}
                      disabled={!editable}
                      value={track.gainDb}
                      onChange={(event) =>
                        updateTrack(track.trackId, {
                          gainDb: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Pan
                    <input
                      className={`${input} mt-1 w-full`}
                      type="number"
                      min={-1}
                      max={1}
                      step={0.1}
                      disabled={!editable}
                      value={track.pan}
                      onChange={(event) =>
                        updateTrack(track.trackId, {
                          pan: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Start tick
                    <input
                      className={`${input} mt-1 w-full`}
                      type="number"
                      min={0}
                      disabled={!editable}
                      value={clip.startTick}
                      onChange={(event) =>
                        updateTrack(track.trackId, {
                          clips: [
                            { ...clip, startTick: Number(event.target.value) },
                          ],
                        })
                      }
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Length ticks
                    <input
                      className={`${input} mt-1 w-full`}
                      type="number"
                      min={1}
                      disabled={!editable}
                      value={clip.durationTicks}
                      onChange={(event) =>
                        updateTrack(track.trackId, {
                          clips: [
                            {
                              ...clip,
                              durationTicks: Number(event.target.value),
                            },
                          ],
                        })
                      }
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={track.muted}
                      disabled={!editable}
                      onChange={(event) =>
                        updateTrack(track.trackId, {
                          muted: event.target.checked,
                        })
                      }
                    />
                    Mute
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={track.soloed}
                      disabled={!editable}
                      onChange={(event) =>
                        updateTrack(track.trackId, {
                          soloed: event.target.checked,
                        })
                      }
                    />
                    Solo
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={clip.loop}
                      disabled={!editable}
                      onChange={(event) =>
                        updateTrack(track.trackId, {
                          clips: [{ ...clip, loop: event.target.checked }],
                        })
                      }
                    />
                    Loop
                  </label>
                  {editable && (
                    <button
                      className="text-danger text-left text-sm underline"
                      type="button"
                      onClick={() => removeTrack(track.trackId)}
                    >
                      Remove track
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {editable && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            className={button}
            type="button"
            disabled={status !== "dirty"}
            onClick={() => void persist()}
          >
            {status === "saving" ? "Saving…" : "Save arrangement"}
          </button>
          {props.mode === "workspace" && (
            <button
              className="cta-gradient min-h-11 rounded-full px-5 text-sm font-semibold disabled:opacity-50"
              type="button"
              disabled={status !== "saved" || manifest.tracks.length === 0}
              onClick={() => void publish()}
            >
              Publish immutable revision
            </button>
          )}
          <span className="text-muted text-sm" role="status">
            {status === "saved"
              ? "All changes saved"
              : status === "dirty"
                ? "Unsaved arrangement changes"
                : status}
          </span>
        </div>
      )}
      {message && (
        <p
          className={
            status === "conflict" || status === "error"
              ? "text-danger"
              : "text-muted"
          }
          role="status"
        >
          {message}
        </p>
      )}
    </section>
  );
}

async function loadAudioSources(
  props: Props,
  manifest: WorkspaceManifestV2,
  signal: AbortSignal,
): Promise<SignedAudioSource[]> {
  const assetIds = [
    ...new Set(
      manifest.tracks.flatMap((track) =>
        track.kind === "audio" ? [track.assetId] : [],
      ),
    ),
  ];
  if (assetIds.length === 0) return [];
  const endpoint =
    props.mode === "workspace" || props.mode === "contribution"
      ? `/api/projects/${props.projectId}/workspaces/${props.workspaceId}/audio-sources`
      : props.mode === "revision"
        ? `/api/projects/${props.projectId}/revisions/${props.revisionId}/audio-sources`
        : props.mode === "contributionVersion"
          ? `/api/projects/${props.projectId}/contributions/${props.contributionId}/versions/${props.versionId}/audio-sources`
          : null;
  if (!endpoint) throw new Error("Mixed contribution playback is not enabled");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      props.mode === "workspace" || props.mode === "contribution"
        ? { mode: "load", assetIds }
        : { assetIds },
    ),
    signal,
  });
  if (!response.ok) throw new Error("Private audio could not be authorized");
  const payload = (await response.json()) as { sources?: SignedAudioSource[] };
  if (!payload.sources || payload.sources.length !== assetIds.length)
    throw new Error("Private audio descriptor mismatch");
  return payload.sources;
}
