"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  FiChevronDown,
  FiChevronUp,
  FiCopy,
  FiCrosshair,
  FiLayers,
  FiMinus,
  FiMove,
  FiPause,
  FiPlay,
  FiPlus,
  FiRotateCcw,
  FiRotateCw,
  FiScissors,
  FiTrash2,
  FiUpload,
  FiX,
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
import {
  copyArrangementClip,
  snapArrangementTick,
  type ArrangementClipboard,
  type ArrangementCommand,
} from "./commands";
import { pixelsToTicks } from "./timeline";

const iconButton =
  "border-strong text-muted hover:border-accent hover:text-accent grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-40";
const button =
  "border-strong hover:border-accent inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-semibold disabled:opacity-50";
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
  onEditMidiClip: (trackId: string, clipId: string) => void;
  onCommand: (command: ArrangementCommand, group?: string | null) => boolean;
  pendingMidiLane: { trackId: string; name: string } | null;
  onAddMidiLane: () => void;
  onPendingMidiLaneNameChange: (name: string) => void;
  onOpenPendingPianoRoll: () => void;
  onImportPendingMidi: (file: File) => void;
  onClosePendingMidiLane: () => void;
  finalizedClip: { trackId: string; clipId: string; token: number } | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
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
  const [snapTicks, setSnapTicks] = useState<number | null>(120);
  const [clipboard, setClipboard] = useState<ArrangementClipboard | null>(null);
  const [clipDrag, setClipDrag] = useState<{
    trackId: string;
    clipId: string;
    pointerId: number;
    originX: number;
    startTick: number;
    previewTick: number;
    targetTrackId: string;
    copy: boolean;
  } | null>(null);
  const [trackDrag, setTrackDrag] = useState<{
    trackId: string;
    pointerId: number;
    originY: number;
    sourceIndex: number;
    targetIndex: number;
  } | null>(null);
  const [rulerPointerId, setRulerPointerId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingImportRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (!props.finalizedClip) return;
    const finalizedClip = props.finalizedClip;
    const frame = requestAnimationFrame(() => {
      setSelection({
        kind: "clip",
        trackId: finalizedClip.trackId,
        clipId: finalizedClip.clipId,
      });
      scrollRef.current
        ?.querySelector<HTMLElement>(`[data-clip-id="${finalizedClip.clipId}"]`)
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [props.finalizedClip]);

  const selectedTrack = selection
    ? view.tracks.find((track) => track.trackId === selection.trackId)
    : null;
  const selectedClip =
    selection?.kind === "clip"
      ? selectedTrack?.clips.find((clip) => clip.clipId === selection.clipId)
      : null;

  function beginClipDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    trackId: string,
    clipId: string,
    startTick: number,
  ) {
    if (!props.editable || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelection({ kind: "clip", trackId, clipId });
    setClipDrag({
      trackId,
      clipId,
      pointerId: event.pointerId,
      originX: event.clientX,
      startTick,
      previewTick: startTick,
      targetTrackId: trackId,
      copy: false,
    });
  }

  function previewClipDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!clipDrag || clipDrag.pointerId !== event.pointerId) return;
    const deltaTicks = pixelsToTicks(event.clientX - clipDrag.originX, scale);
    const unsnapped = Math.max(0, clipDrag.startTick + deltaTicks);
    const targetTrackId = findTargetTrackId(event) ?? clipDrag.trackId;
    setClipDrag({
      ...clipDrag,
      targetTrackId,
      copy: event.ctrlKey || event.metaKey,
      previewTick: snapArrangementTick(
        unsnapped,
        event.altKey ? null : snapTicks,
      ),
    });
  }

  function commitClipDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!clipDrag || clipDrag.pointerId !== event.pointerId) return;
    const deltaTicks = pixelsToTicks(event.clientX - clipDrag.originX, scale);
    const finalTick = snapArrangementTick(
      Math.max(0, clipDrag.startTick + deltaTicks),
      event.altKey ? null : snapTicks,
    );
    const targetTrackId = findTargetTrackId(event) ?? clipDrag.targetTrackId;
    const copy = event.ctrlKey || event.metaKey || clipDrag.copy;
    if (targetTrackId !== clipDrag.trackId) {
      props.onCommand(
        copy
          ? {
              type: "copyClipToTrack",
              sourceTrackId: clipDrag.trackId,
              targetTrackId,
              clipId: clipDrag.clipId,
              newClipId: crypto.randomUUID(),
              startTick: finalTick,
            }
          : {
              type: "moveClipToTrack",
              sourceTrackId: clipDrag.trackId,
              targetTrackId,
              clipId: clipDrag.clipId,
              startTick: finalTick,
            },
      );
    } else if (copy) {
      props.onCommand({
        type: "copyClipToTrack",
        sourceTrackId: clipDrag.trackId,
        targetTrackId,
        clipId: clipDrag.clipId,
        newClipId: crypto.randomUUID(),
        startTick: finalTick,
      });
    } else if (finalTick !== clipDrag.startTick) {
      props.onCommand({
        type: "moveClip",
        trackId: clipDrag.trackId,
        clipId: clipDrag.clipId,
        startTick: finalTick,
      });
    }
    setClipDrag(null);
  }

  function findTargetTrackId(event: ReactPointerEvent<HTMLElement>) {
    const elements = document.elementsFromPoint?.(event.clientX, event.clientY);
    const lane = elements?.find((element) =>
      element.hasAttribute("data-arranger-track-id"),
    );
    return lane?.getAttribute("data-arranger-track-id") ?? null;
  }

  function cancelClipDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!clipDrag || clipDrag.pointerId !== event.pointerId) return;
    setClipDrag(null);
  }

  function seekFromRuler(event: ReactPointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
    props.onSeek(
      Math.max(0, Math.min(view.durationTicks, pixelsToTicks(x, scale))),
    );
  }

  function beginTrackDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    trackId: string,
    sourceIndex: number,
  ) {
    if (!props.editable || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setTrackDrag({
      trackId,
      pointerId: event.pointerId,
      originY: event.clientY,
      sourceIndex,
      targetIndex: sourceIndex,
    });
  }

  function previewTrackDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!trackDrag || trackDrag.pointerId !== event.pointerId) return;
    setTrackDrag({
      ...trackDrag,
      targetIndex: Math.max(
        0,
        Math.min(
          view.tracks.length - 1,
          trackDrag.sourceIndex +
            Math.round((event.clientY - trackDrag.originY) / 128),
        ),
      ),
    });
  }

  function commitTrackDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!trackDrag || trackDrag.pointerId !== event.pointerId) return;
    if (trackDrag.targetIndex !== trackDrag.sourceIndex)
      props.onCommand({
        type: "reorderTrack",
        trackId: trackDrag.trackId,
        targetIndex: trackDrag.targetIndex,
      });
    setTrackDrag(null);
  }

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
        const modifier = event.ctrlKey || event.metaKey;
        if (modifier && event.key.toLowerCase() === "z") {
          event.preventDefault();
          if (event.shiftKey) props.onRedo();
          else props.onUndo();
          return;
        }
        if (modifier && event.key.toLowerCase() === "y") {
          event.preventDefault();
          props.onRedo();
          return;
        }
        if (selection?.kind === "clip" && modifier) {
          const key = event.key.toLowerCase();
          if (key === "c") {
            event.preventDefault();
            setClipboard(
              copyArrangementClip(
                props.manifest,
                selection.trackId,
                selection.clipId,
              ),
            );
            return;
          }
          if (key === "v" && clipboard) {
            event.preventDefault();
            props.onCommand({
              type: "pasteClip",
              targetTrackId: selection.trackId,
              clipboard,
              newClipId: crypto.randomUUID(),
              startTick: props.playheadTick,
            });
            return;
          }
          if (key === "d") {
            event.preventDefault();
            props.onCommand({
              type: "duplicateClip",
              trackId: selection.trackId,
              clipId: selection.clipId,
              newClipId: crypto.randomUUID(),
            });
            return;
          }
        }
        if (
          selection?.kind === "clip" &&
          selectedClip?.kind === "midi" &&
          event.key === "Enter"
        ) {
          event.preventDefault();
          props.onEditMidiClip(selection.trackId, selection.clipId);
          return;
        }
        if (
          selection?.kind === "clip" &&
          (event.key === "ArrowLeft" || event.key === "ArrowRight")
        ) {
          event.preventDefault();
          const selected = selectedClip;
          if (!selected) return;
          const step = event.altKey ? 1 : (snapTicks ?? 1);
          props.onCommand({
            type: "moveClip",
            trackId: selection.trackId,
            clipId: selection.clipId,
            startTick: Math.max(
              0,
              selected.startTick + (event.key === "ArrowLeft" ? -step : step),
            ),
          });
          return;
        }
        if (
          selection?.kind === "clip" &&
          event.key === "Delete" &&
          selectedClip?.kind === "midi"
        ) {
          event.preventDefault();
          props.onCommand({
            type: "deleteMidiClip",
            trackId: selection.trackId,
            clipId: selection.clipId,
          });
          setSelection({ kind: "track", trackId: selection.trackId });
          return;
        }
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
          <label className="text-muted hidden text-[10px] font-semibold uppercase md:block">
            Snap
            <select
              aria-label="Arrangement snap grid"
              className="border-strong bg-canvas rounded-control ml-2 h-9 border px-2 text-xs"
              value={snapTicks ?? "off"}
              onChange={(event) =>
                setSnapTicks(
                  event.target.value === "off"
                    ? null
                    : Number(event.target.value),
                )
              }
            >
              <option value={480}>1/4</option>
              <option value={240}>1/8</option>
              <option value={120}>1/16</option>
              <option value="off">Off</option>
            </select>
          </label>
          <button
            type="button"
            className={iconButton}
            aria-label="Undo arrangement edit"
            title="Undo arrangement edit"
            disabled={!props.editable || !props.canUndo}
            onClick={props.onUndo}
          >
            <FiRotateCcw />
          </button>
          <button
            type="button"
            className={iconButton}
            aria-label="Redo arrangement edit"
            title="Redo arrangement edit"
            disabled={!props.editable || !props.canRedo}
            onClick={props.onRedo}
          >
            <FiRotateCw />
          </button>
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
              <div
                className="relative cursor-col-resize touch-none"
                style={{ width: timelineWidth }}
                role="slider"
                tabIndex={0}
                aria-label="Arrangement playhead"
                aria-valuemin={0}
                aria-valuemax={view.durationTicks}
                aria-valuenow={props.playheadTick}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
                    return;
                  event.preventDefault();
                  event.stopPropagation();
                  props.onSeek(
                    Math.max(
                      0,
                      Math.min(
                        view.durationTicks,
                        props.playheadTick +
                          (event.key === "ArrowLeft" ? -1 : 1),
                      ),
                    ),
                  );
                }}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setRulerPointerId(event.pointerId);
                  seekFromRuler(event);
                }}
                onPointerMove={(event) => {
                  if (rulerPointerId === event.pointerId) seekFromRuler(event);
                }}
                onPointerUp={(event) => {
                  if (rulerPointerId !== event.pointerId) return;
                  seekFromRuler(event);
                  setRulerPointerId(null);
                }}
                onPointerCancel={() => setRulerPointerId(null)}
                onLostPointerCapture={() => setRulerPointerId(null)}
              >
                {marks.map((mark) => (
                  <span
                    aria-hidden
                    key={mark.tick}
                    className={`border-subtle absolute top-0 h-full border-l text-left font-mono text-[10px] ${mark.beat === 1 ? "text-ink" : "text-muted"}`}
                    style={{ left: ticksToPixels(mark.tick, scale) }}
                  >
                    <span className="ml-1">
                      {mark.beat === 1 ? mark.bar : mark.beat}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            {view.tracks.length === 0 && !props.pendingMidiLane ? (
              <div className="sticky left-60 grid min-h-40 max-w-[calc(100vw-20rem)] place-items-center px-8 text-center">
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
            ) : view.tracks.length > 0 ? (
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
                      className={`border-subtle grid h-32 grid-cols-[15rem_1fr] border-b ${selected ? "bg-surface-soft" : ""} ${trackDrag?.targetIndex === trackIndex || clipDrag?.targetTrackId === track.trackId ? "ring-accent ring-2 ring-inset" : ""}`}
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
                            aria-label={`Drag ${track.name} to reorder`}
                            title="Drag to reorder"
                            disabled={!props.editable}
                            onPointerDown={(event) =>
                              beginTrackDrag(event, track.trackId, trackIndex)
                            }
                            onPointerMove={previewTrackDrag}
                            onPointerUp={commitTrackDrag}
                          >
                            <FiMove />
                          </button>
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
                        data-arranger-track-id={track.trackId}
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
                          const previewTick =
                            clipDrag?.clipId === clip.clipId
                              ? clipDrag.previewTick
                              : clip.startTick;
                          const left = ticksToPixels(previewTick, scale);
                          const width = Math.max(
                            12,
                            ticksToPixels(clip.durationTicks, scale),
                          );
                          return (
                            <button
                              type="button"
                              key={clip.clipId}
                              data-clip-id={clip.clipId}
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
                              onDoubleClick={() => {
                                if (clip.kind === "midi")
                                  props.onEditMidiClip(
                                    track.trackId,
                                    clip.clipId,
                                  );
                              }}
                              onPointerDown={(event) =>
                                beginClipDrag(
                                  event,
                                  track.trackId,
                                  clip.clipId,
                                  clip.startTick,
                                )
                              }
                              onPointerMove={previewClipDrag}
                              onPointerUp={commitClipDrag}
                              onPointerCancel={cancelClipDrag}
                              onLostPointerCapture={cancelClipDrag}
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
            ) : null}
            {props.pendingMidiLane && (
              <div className="border-accent bg-surface-soft sticky left-0 z-20 grid min-h-32 w-[min(100%,calc(100vw-2rem))] grid-cols-[15rem_minmax(30rem,1fr)] border-y border-dashed">
                <div className="border-subtle bg-surface-soft sticky left-0 z-30 flex flex-col justify-center border-r p-3">
                  <label className="text-muted text-[10px] font-semibold tracking-wide uppercase">
                    Pending MIDI track
                    <input
                      className={`${field} mt-1`}
                      aria-label="Pending track name"
                      value={props.pendingMidiLane.name}
                      maxLength={120}
                      autoFocus
                      onChange={(event) =>
                        props.onPendingMidiLaneNameChange(event.target.value)
                      }
                    />
                  </label>
                </div>
                <div className="relative flex min-w-[30rem] items-center justify-center gap-2 px-6">
                  <button
                    type="button"
                    className="cta-gradient text-accent-contrast min-h-11 rounded-full px-4 text-sm font-semibold disabled:opacity-50"
                    disabled={!props.pendingMidiLane.name.trim()}
                    onClick={props.onOpenPendingPianoRoll}
                  >
                    Open piano roll
                  </button>
                  <button
                    type="button"
                    className={`${button} gap-2`}
                    disabled={!props.pendingMidiLane.name.trim()}
                    onClick={() => pendingImportRef.current?.click()}
                  >
                    <FiUpload /> Import .mid
                  </button>
                  <input
                    ref={pendingImportRef}
                    className="sr-only"
                    type="file"
                    accept=".mid,.midi,audio/midi,audio/x-midi"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) props.onImportPendingMidi(file);
                      event.currentTarget.value = "";
                    }}
                  />
                  <button
                    type="button"
                    className={`${button} gap-2`}
                    disabled={
                      !props.pendingMidiLane.name.trim() ||
                      clipboard?.kind !== "midi"
                    }
                    onClick={() => {
                      if (!props.pendingMidiLane || clipboard?.kind !== "midi")
                        return;
                      const clipId = crypto.randomUUID();
                      const applied = props.onCommand({
                        type: "materializeMidiTrack",
                        trackId: props.pendingMidiLane.trackId,
                        name: props.pendingMidiLane.name,
                        clipboard,
                        newClipId: clipId,
                        startTick: props.playheadTick,
                      });
                      if (applied) {
                        setSelection({
                          kind: "clip",
                          trackId: props.pendingMidiLane.trackId,
                          clipId,
                        });
                        props.onClosePendingMidiLane();
                      }
                    }}
                  >
                    <FiCopy /> Paste compatible clip
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    aria-label="Close pending track"
                    onClick={props.onClosePendingMidiLane}
                  >
                    <FiX />
                  </button>
                </div>
              </div>
            )}
            <div className="border-subtle bg-surface sticky left-0 z-20 grid h-16 w-[min(100%,calc(100vw-2rem))] grid-cols-[15rem_minmax(30rem,1fr)] border-b">
              <button
                type="button"
                className="border-subtle text-accent hover:bg-surface-soft disabled:text-muted sticky left-0 flex items-center gap-2 border-r px-4 text-sm font-semibold disabled:opacity-60"
                disabled={!props.editable || props.pendingMidiLane !== null}
                onClick={props.onAddMidiLane}
              >
                <FiPlus /> Add a track
              </button>
              <p className="text-muted flex items-center justify-center px-6 text-sm">
                {props.pendingMidiLane
                  ? "Finish or close the pending lane before adding another."
                  : "The next MIDI lane is ready here."}
              </p>
            </div>
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
              key={selectedClip.clipId}
              clip={selectedClip}
              track={selectedTrack}
              editable={props.editable}
              midiVersions={props.midiVersions}
              onPatch={(patch, group) =>
                props.onCommand(
                  {
                    type: "patchClip",
                    trackId: selectedTrack.trackId,
                    clipId: selectedClip.clipId,
                    patch,
                  },
                  `${selectedClip.clipId}:${group}`,
                )
              }
              onReplace={(versionId) =>
                props.onReplaceVersion(
                  selectedTrack.trackId,
                  selectedClip.clipId,
                  versionId,
                )
              }
              onEdit={() =>
                props.onEditMidiClip(selectedTrack.trackId, selectedClip.clipId)
              }
              canPaste={
                clipboard?.kind === selectedTrack.kind &&
                (clipboard?.kind !== "audio" ||
                  selectedTrack.assetId === clipboard.assetId)
              }
              onCopy={() =>
                setClipboard(
                  copyArrangementClip(
                    props.manifest,
                    selectedTrack.trackId,
                    selectedClip.clipId,
                  ),
                )
              }
              onPaste={() => {
                if (!clipboard) return;
                props.onCommand({
                  type: "pasteClip",
                  targetTrackId: selectedTrack.trackId,
                  clipboard,
                  newClipId: crypto.randomUUID(),
                  startTick: props.playheadTick,
                });
              }}
              onDuplicate={() =>
                props.onCommand({
                  type: "duplicateClip",
                  trackId: selectedTrack.trackId,
                  clipId: selectedClip.clipId,
                  newClipId: crypto.randomUUID(),
                })
              }
              onDelete={() => {
                props.onCommand({
                  type: "deleteMidiClip",
                  trackId: selectedTrack.trackId,
                  clipId: selectedClip.clipId,
                });
                setSelection({
                  kind: "track",
                  trackId: selectedTrack.trackId,
                });
              }}
              onSplit={(splitOffsetMs) =>
                props.onCommand({
                  type: "splitAudioClip",
                  trackId: selectedTrack.trackId,
                  clipId: selectedClip.clipId,
                  splitOffsetMs,
                  newClipId: crypto.randomUUID(),
                })
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
  onEdit,
  canPaste,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  onSplit,
}: {
  clip: ReturnType<
    typeof buildArrangerViewModel
  >["tracks"][number]["clips"][number];
  track: ReturnType<typeof buildArrangerViewModel>["tracks"][number];
  editable: boolean;
  midiVersions: readonly MidiStemVersion[];
  onPatch: (patch: Record<string, number | boolean>, group: string) => void;
  onReplace: (versionId: string) => void;
  onEdit: () => void;
  canPaste: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSplit: (splitOffsetMs: number) => void;
}) {
  const [splitOffsetMs, setSplitOffsetMs] = useState(
    Math.max(1, Math.floor(clip.durationMs / 2)),
  );
  return (
    <div className="mt-3 space-y-3">
      <h3 className="truncate font-semibold">{track.name} clip</h3>
      <p className="text-muted text-xs">
        {clip.creditName} · {clip.durationTicks} ticks
      </p>
      {editable && (
        <div className="flex flex-wrap gap-2" aria-label="Clip commands">
          <button
            type="button"
            className={iconButton}
            aria-label="Copy selected clip"
            title="Copy selected clip"
            onClick={onCopy}
          >
            <FiCopy />
          </button>
          <button
            type="button"
            className={iconButton}
            aria-label="Paste clip into this track"
            title="Paste clip into this track"
            disabled={!canPaste}
            onClick={onPaste}
          >
            <FiLayers />
          </button>
          <button
            type="button"
            className={iconButton}
            aria-label="Duplicate selected clip"
            title="Duplicate selected clip"
            onClick={onDuplicate}
          >
            <FiCopy />
          </button>
          {clip.kind === "midi" && (
            <button
              type="button"
              className={`${iconButton} text-danger`}
              aria-label="Delete selected MIDI clip"
              title="Delete selected MIDI clip"
              onClick={onDelete}
            >
              <FiTrash2 />
            </button>
          )}
        </div>
      )}
      <p className="text-muted text-[11px]">
        Clipboard data stays in this Studio session. MIDI adopts a compatible
        destination track&apos;s sound; audio remains on the same source. Hold
        Alt while dragging for no snap.
      </p>
      {clip.kind === "midi" ? (
        <>
          {editable && (
            <button
              type="button"
              className="border-strong min-h-11 w-full rounded-full border px-3 text-sm font-semibold"
              onClick={onEdit}
            >
              Edit MIDI part
            </button>
          )}
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
            onChange={(startTick) => onPatch({ startTick }, "start")}
          />
          <ExactNumber
            label="Source offset ticks"
            value={clip.sourceStartTick ?? 0}
            editable={editable}
            min={0}
            onChange={(sourceStartTick) =>
              onPatch({ sourceStartTick }, "source-offset")
            }
          />
          <ExactNumber
            label="Length ticks"
            value={clip.durationTicks}
            editable={editable}
            min={1}
            onChange={(durationTicks) => onPatch({ durationTicks }, "duration")}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={clip.loop}
              disabled={!editable}
              onChange={(event) =>
                onPatch({ loop: event.target.checked }, "loop")
              }
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
            onChange={(positionMs) => onPatch({ positionMs }, "start")}
          />
          <ExactNumber
            label="Trim start ms"
            value={clip.trimStartMs ?? 0}
            editable={editable}
            min={0}
            onChange={(trimStartMs) =>
              onPatch({ trimStartMs }, "source-offset")
            }
          />
          <ExactNumber
            label="Length ms"
            value={clip.durationMs}
            editable={editable}
            min={1}
            onChange={(durationMs) => onPatch({ durationMs }, "duration")}
          />
          {editable && (
            <div className="border-subtle rounded-control space-y-2 border p-3">
              <ExactNumber
                label="Split offset ms"
                value={splitOffsetMs}
                editable
                min={1}
                onChange={setSplitOffsetMs}
              />
              <button
                type="button"
                className="border-strong hover:border-accent inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border px-3 text-sm font-semibold"
                onClick={() => onSplit(splitOffsetMs)}
              >
                <FiScissors /> Split inside immutable source
              </button>
            </div>
          )}
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
