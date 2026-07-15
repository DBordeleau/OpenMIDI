"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  FiChevronDown,
  FiChevronUp,
  FiCrosshair,
  FiMinus,
  FiPause,
  FiPlay,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import type { MidiStemVersion } from "@/features/midi/stems/types";
import type { WorkspaceManifestV2, WorkspaceTrackV2 } from "../manifest/v2";
import type { AudioLaneSummary } from "./audio-peaks.client";
import { type ArrangerSelection, moveSelection } from "./selection";
import {
  clampZoom,
  DEFAULT_PIXELS_PER_QUARTER,
  getRulerMarks,
  ticksToPixels,
} from "./timeline";
import { buildArrangerViewModel } from "./view-model";

const iconButton =
  "border-strong text-muted hover:border-accent hover:text-accent grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-40";
const field =
  "border-strong bg-canvas rounded-control min-h-10 w-full border px-2 text-sm disabled:opacity-60";

type Props = {
  manifest: WorkspaceManifestV2;
  midiVersions: readonly MidiStemVersion[];
  trackCredits: readonly {
    trackId: string;
    instrumentName: string | null;
    creditName: string;
  }[];
  audioSummaries: ReadonlyMap<string, AudioLaneSummary>;
  editable: boolean;
  playing: boolean;
  playheadTick: number;
  onTogglePlayback: () => void;
  onSeek: (tick: number) => void;
  onTrackPatch: (trackId: string, patch: Partial<WorkspaceTrackV2>) => void;
  onClipPatch: (
    trackId: string,
    clipId: string,
    patch: Record<string, number | boolean>,
  ) => void;
  onMoveTrack: (trackId: string, delta: -1 | 1) => void;
  onRemoveTrack: (trackId: string) => void;
  onReplaceVersion: (
    trackId: string,
    clipId: string,
    versionId: string,
  ) => void;
  actionRegion: ReactNode;
  statusRegion: ReactNode;
};

export function ArrangerWorkspace(props: Props) {
  const view = useMemo(
    () =>
      buildArrangerViewModel({
        manifest: props.manifest,
        midiVersions: props.midiVersions,
        trackCredits: props.trackCredits,
      }),
    [props.manifest, props.midiVersions, props.trackCredits],
  );
  const [selection, setSelection] = useState<ArrangerSelection>(() =>
    view.tracks[0] ? { kind: "track", trackId: view.tracks[0].trackId } : null,
  );
  const [pixelsPerQuarter, setPixelsPerQuarter] = useState(
    DEFAULT_PIXELS_PER_QUARTER,
  );
  const [follow, setFollow] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scale = { tempoBpm: view.tempoBpm, pixelsPerQuarter };
  const timelineWidth = Math.max(720, ticksToPixels(view.durationTicks, scale));
  const playheadLeft = ticksToPixels(props.playheadTick, scale);
  const marks = getRulerMarks({
    durationTicks: view.durationTicks,
    ...view.timeSignature,
  });

  useEffect(() => {
    if (!follow || !props.playing || !scrollRef.current) return;
    const viewport = scrollRef.current;
    const target = Math.max(0, playheadLeft - viewport.clientWidth * 0.55);
    viewport.scrollTo({
      left: target,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [follow, playheadLeft, props.playing]);

  const selectedTrack = selection
    ? view.tracks.find((track) => track.trackId === selection.trackId)
    : null;
  const selectedClip =
    selection?.kind === "clip"
      ? selectedTrack?.clips.find((clip) => clip.clipId === selection.clipId)
      : null;

  return (
    <section
      aria-label="Arrangement workspace"
      className="rounded-card border-strong bg-surface overflow-hidden border shadow-xl"
      onKeyDown={(event) => {
        if (
          event.target instanceof HTMLElement &&
          event.target.matches("input, select, textarea")
        )
          return;
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault();
        setSelection(
          moveSelection(
            view.tracks,
            selection,
            event.key === "ArrowDown" ? 1 : -1,
          ),
        );
      }}
      tabIndex={0}
    >
      <header className="border-subtle bg-surface-raised flex flex-wrap items-center justify-between gap-3 border-b p-3">
        <div className="flex items-center gap-2" aria-label="Transport">
          <button
            type="button"
            className="cta-gradient grid h-11 w-11 place-items-center rounded-full text-lg disabled:opacity-50"
            aria-label={
              props.playing ? "Pause arrangement" : "Play arrangement"
            }
            disabled={view.tracks.length === 0}
            onClick={props.onTogglePlayback}
          >
            {props.playing ? <FiPause /> : <FiPlay />}
          </button>
          <p className="min-w-24 font-mono text-sm" aria-live="off">
            {formatMusicalPosition(props.playheadTick, view.timeSignature)}
          </p>
          <p className="text-muted hidden text-xs lg:block">
            {view.tempoBpm} BPM · {view.timeSignature.numerator}/
            {view.timeSignature.denominator}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={iconButton}
            aria-label="Zoom out"
            onClick={() =>
              setPixelsPerQuarter((value) => clampZoom(value / 1.5))
            }
          >
            <FiMinus />
          </button>
          <span className="text-muted w-14 text-center font-mono text-xs">
            {Math.round((pixelsPerQuarter / DEFAULT_PIXELS_PER_QUARTER) * 100)}%
          </span>
          <button
            type="button"
            className={iconButton}
            aria-label="Zoom in"
            onClick={() =>
              setPixelsPerQuarter((value) => clampZoom(value * 1.5))
            }
          >
            <FiPlus />
          </button>
          <button
            type="button"
            aria-pressed={follow}
            className={`${iconButton} ${follow ? "border-accent text-accent" : ""}`}
            aria-label="Follow playhead"
            onClick={() => setFollow((value) => !value)}
          >
            <FiCrosshair />
          </button>
          {props.actionRegion}
        </div>
      </header>

      <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div
          ref={scrollRef}
          className="max-h-[38rem] min-w-0 overflow-auto overscroll-contain"
        >
          <div
            className="relative min-w-max"
            style={{ width: timelineWidth + 240 }}
          >
            <div className="border-subtle bg-surface sticky top-0 z-30 grid h-11 grid-cols-[15rem_1fr] border-b">
              <div className="border-subtle bg-surface sticky left-0 z-40 flex items-center border-r px-3">
                <span className="text-muted font-mono text-[10px] tracking-widest uppercase">
                  Channels
                </span>
              </div>
              <div className="relative" style={{ width: timelineWidth }}>
                {marks.map((mark) => (
                  <button
                    type="button"
                    key={mark.tick}
                    className={`border-subtle absolute top-0 h-full border-l text-left font-mono text-[10px] ${mark.beat === 1 ? "text-ink" : "text-muted"}`}
                    style={{ left: ticksToPixels(mark.tick, scale) }}
                    aria-label={`Seek to bar ${mark.bar}, beat ${mark.beat}`}
                    onClick={() => props.onSeek(mark.tick)}
                  >
                    <span className="ml-1">
                      {mark.beat === 1 ? mark.bar : mark.beat}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {view.tracks.length === 0 ? (
              <div
                className="grid min-h-52 place-items-center px-8 text-center"
                style={{ width: timelineWidth + 240 }}
              >
                <div>
                  <h3 className="text-xl font-semibold">
                    Bring in your first MIDI part.
                  </h3>
                  <p className="text-muted mt-2">
                    Use Add / import to place an immutable take on this
                    timeline.
                  </p>
                </div>
              </div>
            ) : (
              <ol aria-label="Arrangement tracks">
                {view.tracks.map((track, trackIndex) => {
                  const selected = selection?.trackId === track.trackId;
                  const readiness =
                    track.kind === "audio" && track.assetId
                      ? props.audioSummaries.get(track.assetId)
                      : null;
                  return (
                    <li
                      key={track.trackId}
                      className={`border-subtle grid h-32 grid-cols-[15rem_1fr] border-b ${selected ? "bg-surface-soft" : ""}`}
                    >
                      <div className="border-subtle bg-surface sticky left-0 z-20 border-r p-2.5">
                        <button
                          type="button"
                          className="focus-visible:ring-accent w-full rounded text-left focus-visible:ring-2"
                          onClick={() =>
                            setSelection({
                              kind: "track",
                              trackId: track.trackId,
                            })
                          }
                          aria-label={`Select track ${track.name}. ${track.kind}. ${track.creditName}.`}
                        >
                          <span className="block truncate text-sm font-semibold">
                            {track.name}
                          </span>
                          <span className="text-muted block truncate text-[11px]">
                            {track.instrument} · {track.creditName}
                          </span>
                          <span
                            className={`mt-1 block text-[10px] font-semibold uppercase ${readiness?.status === "failed" ? "text-danger" : readiness?.status === "ready" || track.kind === "midi" ? "text-accent-2" : "text-muted"}`}
                          >
                            {track.kind === "midi"
                              ? "Ready · note summary"
                              : (readiness?.status ?? "Loading source")}
                          </span>
                        </button>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          <label className="text-muted text-[9px] font-semibold uppercase">
                            Gain
                            <input
                              aria-label={`${track.name} compact gain`}
                              className="accent-accent block h-3 w-full"
                              type="range"
                              min={-60}
                              max={6}
                              step={0.5}
                              disabled={!props.editable}
                              value={track.gainDb}
                              onChange={(event) =>
                                props.onTrackPatch(track.trackId, {
                                  gainDb: Number(event.target.value),
                                })
                              }
                            />
                          </label>
                          <label className="text-muted text-[9px] font-semibold uppercase">
                            Pan
                            <input
                              aria-label={`${track.name} compact pan`}
                              className="accent-accent block h-3 w-full"
                              type="range"
                              min={-1}
                              max={1}
                              step={0.1}
                              disabled={!props.editable}
                              value={track.pan}
                              onChange={(event) =>
                                props.onTrackPatch(track.trackId, {
                                  pan: Number(event.target.value),
                                })
                              }
                            />
                          </label>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5">
                          <MixerButton
                            label={`Mute ${track.name}`}
                            active={track.muted}
                            disabled={!props.editable}
                            onClick={() =>
                              props.onTrackPatch(track.trackId, {
                                muted: !track.muted,
                              })
                            }
                          >
                            M
                          </MixerButton>
                          <MixerButton
                            label={`Solo ${track.name}`}
                            active={track.soloed}
                            disabled={!props.editable}
                            onClick={() =>
                              props.onTrackPatch(track.trackId, {
                                soloed: !track.soloed,
                              })
                            }
                          >
                            S
                          </MixerButton>
                          <button
                            className={iconButton}
                            type="button"
                            aria-label={`Move ${track.name} up`}
                            disabled={!props.editable || trackIndex === 0}
                            onClick={() => props.onMoveTrack(track.trackId, -1)}
                          >
                            <FiChevronUp />
                          </button>
                          <button
                            className={iconButton}
                            type="button"
                            aria-label={`Move ${track.name} down`}
                            disabled={
                              !props.editable ||
                              trackIndex === view.tracks.length - 1
                            }
                            onClick={() => props.onMoveTrack(track.trackId, 1)}
                          >
                            <FiChevronDown />
                          </button>
                        </div>
                      </div>
                      <div
                        className="relative overflow-hidden"
                        style={{ width: timelineWidth }}
                      >
                        {marks.map((mark) => (
                          <span
                            aria-hidden
                            key={mark.tick}
                            className={`border-subtle absolute inset-y-0 border-l ${mark.beat === 1 ? "opacity-60" : "opacity-25"}`}
                            style={{ left: ticksToPixels(mark.tick, scale) }}
                          />
                        ))}
                        {track.clips.map((clip) => {
                          const left = ticksToPixels(clip.startTick, scale);
                          const width = Math.max(
                            12,
                            ticksToPixels(clip.durationTicks, scale),
                          );
                          return (
                            <button
                              type="button"
                              key={clip.clipId}
                              className={`focus-visible:ring-accent rounded-control absolute top-3 h-24 overflow-hidden border text-left focus-visible:ring-2 ${selection?.kind === "clip" && selection.clipId === clip.clipId ? "border-accent bg-accent/20" : "border-strong bg-surface-raised"}`}
                              style={{ left, width }}
                              aria-label={`${clip.kind === "midi" ? "MIDI" : "Audio"} clip on ${track.name}, ${formatMusicalPosition(clip.startTick, view.timeSignature)}, duration ${clip.durationTicks} ticks, credited to ${clip.creditName}.`}
                              onClick={() =>
                                setSelection({
                                  kind: "clip",
                                  trackId: track.trackId,
                                  clipId: clip.clipId,
                                })
                              }
                            >
                              <span className="text-ink absolute top-1 left-2 z-10 max-w-[calc(100%-1rem)] truncate text-[10px] font-semibold">
                                {track.name}
                              </span>
                              {clip.kind === "midi" ? (
                                <MidiNotes
                                  notes={clip.notes}
                                  clipStart={clip.startTick}
                                  clipDuration={clip.durationTicks}
                                />
                              ) : (
                                <AudioWaveform summary={readiness} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            <div
              aria-hidden
              className="bg-ink pointer-events-none absolute top-0 bottom-0 z-10 w-px"
              style={{ left: 240 + playheadLeft }}
            />
          </div>
        </div>

        <aside
          className="border-subtle bg-surface-raised min-w-0 border-t p-4 xl:border-t-0 xl:border-l"
          aria-label="Inspector"
        >
          <p className="text-accent font-mono text-[10px] tracking-widest uppercase">
            Inspector
          </p>
          {!selectedTrack ? (
            <p className="text-muted mt-3 text-sm">
              Select a track or clip to inspect exact values.
            </p>
          ) : selectedClip ? (
            <ClipInspector
              clip={selectedClip}
              track={selectedTrack}
              editable={props.editable}
              midiVersions={props.midiVersions}
              onPatch={(patch) =>
                props.onClipPatch(
                  selectedTrack.trackId,
                  selectedClip.clipId,
                  patch,
                )
              }
              onReplace={(versionId) =>
                props.onReplaceVersion(
                  selectedTrack.trackId,
                  selectedClip.clipId,
                  versionId,
                )
              }
            />
          ) : (
            <TrackInspector
              track={selectedTrack}
              editable={props.editable}
              onPatch={(patch) =>
                props.onTrackPatch(selectedTrack.trackId, patch)
              }
              onRemove={() => props.onRemoveTrack(selectedTrack.trackId)}
            />
          )}
        </aside>
      </div>
      <footer className="border-subtle bg-surface-raised flex min-h-12 flex-wrap items-center justify-between gap-3 border-t px-4 py-2">
        <p className="text-muted text-xs" aria-live="polite">
          {selection?.kind === "clip"
            ? "Clip selected. Use the inspector for exact values."
            : selection
              ? "Track selected. Mixer values are available in the inspector."
              : "No selection."}
        </p>
        {props.statusRegion}
      </footer>
    </section>
  );
}

function MixerButton(props: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      aria-pressed={props.active}
      disabled={props.disabled}
      onClick={props.onClick}
      className={`grid h-9 w-9 place-items-center rounded-full border text-xs font-bold ${props.active ? "bg-accent text-accent-contrast border-transparent" : "border-strong text-muted"}`}
    >
      {props.children}
    </button>
  );
}

function MidiNotes({
  notes,
  clipStart,
  clipDuration,
}: {
  notes: readonly {
    noteId: string;
    pitch: number;
    startTick: number;
    durationTicks: number;
    velocity: number;
  }[];
  clipStart: number;
  clipDuration: number;
}) {
  const pitches = notes.map((note) => note.pitch);
  const low = Math.min(...pitches, 48);
  const high = Math.max(...pitches, 72);
  return (
    <span aria-hidden className="absolute inset-x-0 top-6 bottom-0">
      {notes.map((note) => (
        <span
          key={note.noteId}
          className="bg-accent-2 absolute min-w-px rounded-sm"
          style={{
            left: `${((note.startTick - clipStart) / clipDuration) * 100}%`,
            width: `${Math.max(0.5, (note.durationTicks / clipDuration) * 100)}%`,
            bottom: `${((note.pitch - low) / Math.max(1, high - low)) * 80 + 8}%`,
            height: Math.max(2, (note.velocity / 127) * 5),
          }}
        />
      ))}
    </span>
  );
}

function AudioWaveform({
  summary,
}: {
  summary: AudioLaneSummary | null | undefined;
}) {
  const peaks = summary?.peaks.length
    ? summary.peaks
    : Array.from({ length: 48 }, (_, index) => 0.2 + ((index * 17) % 7) / 14);
  return (
    <span
      aria-hidden
      className={`absolute inset-x-0 top-7 bottom-2 flex items-center gap-px px-1 ${summary?.status === "failed" ? "opacity-25" : ""}`}
    >
      {peaks.map((peak, index) => (
        <span
          key={index}
          className="bg-accent min-w-px flex-1 rounded-full"
          style={{ height: `${Math.max(8, peak * 92)}%` }}
        />
      ))}
    </span>
  );
}

function TrackInspector({
  track,
  editable,
  onPatch,
  onRemove,
}: {
  track: ReturnType<typeof buildArrangerViewModel>["tracks"][number];
  editable: boolean;
  onPatch: (patch: Partial<WorkspaceTrackV2>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="mt-3 space-y-3">
      <h3 className="truncate font-semibold">{track.name}</h3>
      <p className="text-muted text-xs">
        {track.kind} · {track.creditName}
      </p>
      <label className="block text-xs font-semibold">
        Gain (dB)
        <input
          aria-label={`${track.name} gain`}
          className={`${field} mt-1`}
          type="number"
          min={-60}
          max={6}
          step={0.5}
          disabled={!editable}
          value={track.gainDb}
          onChange={(event) => onPatch({ gainDb: Number(event.target.value) })}
        />
      </label>
      <label className="block text-xs font-semibold">
        Pan
        <input
          aria-label={`${track.name} pan`}
          className={`${field} mt-1`}
          type="number"
          min={-1}
          max={1}
          step={0.1}
          disabled={!editable}
          value={track.pan}
          onChange={(event) => onPatch({ pan: Number(event.target.value) })}
        />
      </label>
      {editable && (
        <button
          className="text-danger inline-flex items-center gap-2 text-sm underline"
          type="button"
          onClick={onRemove}
        >
          <FiTrash2 /> Remove track
        </button>
      )}
    </div>
  );
}

function ClipInspector({
  clip,
  track,
  editable,
  midiVersions,
  onPatch,
  onReplace,
}: {
  clip: ReturnType<
    typeof buildArrangerViewModel
  >["tracks"][number]["clips"][number];
  track: ReturnType<typeof buildArrangerViewModel>["tracks"][number];
  editable: boolean;
  midiVersions: readonly MidiStemVersion[];
  onPatch: (patch: Record<string, number | boolean>) => void;
  onReplace: (versionId: string) => void;
}) {
  return (
    <div className="mt-3 space-y-3">
      <h3 className="truncate font-semibold">{track.name} clip</h3>
      <p className="text-muted text-xs">
        {clip.creditName} · {clip.durationTicks} ticks
      </p>
      {clip.kind === "midi" ? (
        <>
          <label className="block text-xs font-semibold">
            Exact stem version
            <select
              aria-label={`Replace ${track.name} clip version`}
              className={`${field} mt-1`}
              disabled={!editable}
              value={clip.versionId ?? ""}
              onChange={(event) => onReplace(event.target.value)}
            >
              {midiVersions.map((version) => (
                <option
                  key={version.stemVersionId}
                  value={version.stemVersionId}
                >
                  {version.name} · v{version.version}
                </option>
              ))}
            </select>
          </label>
          <ExactNumber
            label="Start tick"
            value={clip.startTick}
            editable={editable}
            min={0}
            onChange={(startTick) => onPatch({ startTick })}
          />
          <ExactNumber
            label="Length ticks"
            value={clip.durationTicks}
            editable={editable}
            min={1}
            onChange={(durationTicks) => onPatch({ durationTicks })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={clip.loop}
              disabled={!editable}
              onChange={(event) => onPatch({ loop: event.target.checked })}
            />
            Loop
          </label>
        </>
      ) : (
        <>
          <ExactNumber
            label="Start ms"
            value={clip.startMs}
            editable={editable}
            min={0}
            onChange={(positionMs) => onPatch({ positionMs })}
          />
          <ExactNumber
            label="Trim start ms"
            value={clip.trimStartMs ?? 0}
            editable={editable}
            min={0}
            onChange={(trimStartMs) => onPatch({ trimStartMs })}
          />
          <ExactNumber
            label="Length ms"
            value={clip.durationMs}
            editable={editable}
            min={1}
            onChange={(durationMs) => onPatch({ durationMs })}
          />
        </>
      )}
    </div>
  );
}

function ExactNumber({
  label,
  value,
  editable,
  min,
  onChange,
}: {
  label: string;
  value: number;
  editable: boolean;
  min: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-xs font-semibold">
      {label}
      <input
        className={`${field} mt-1`}
        type="number"
        min={min}
        disabled={!editable}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function formatMusicalPosition(
  tick: number,
  signature: { numerator: number; denominator: number },
) {
  const beatTicks = (480 * 4) / signature.denominator;
  const beatIndex = Math.floor(tick / beatTicks);
  return `${Math.floor(beatIndex / signature.numerator) + 1}.${(beatIndex % signature.numerator) + 1}.${Math.round(tick % beatTicks)}`;
}
