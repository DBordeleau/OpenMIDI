"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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
  FiTrash2,
  FiUpload,
  FiX,
} from "react-icons/fi";
import type { MidiStemVersion } from "@/features/midi/stems/types";
import type { WorkspaceManifestV2, WorkspaceTrackV2 } from "../manifest/v2";
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

// Keep in lockstep with the `17rem` channel column in the grids below: the
// playhead and timeline are positioned in pixels and must line up with the CSS
// channel width (17rem × 16px = 272px).
const CHANNEL_PX = 272;
const iconButton =
  "border-strong text-muted hover:border-accent hover:text-accent grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-40";
const channelButton =
  "border-strong text-muted hover:border-accent hover:text-accent grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-40";
const AUTO_SCROLL_EDGE = 56;
const AUTO_SCROLL_SPEED = 16;
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
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [clipDrag, setClipDrag] = useState<{
    trackId: string;
    clipId: string;
    pointerId: number;
    originX: number;
    originScrollLeft: number;
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
  const reduce = useReducedMotion();
  const clipDragRef = useRef(clipDrag);
  const dragPointerRef = useRef({ clientX: 0, altKey: false });
  const autoScrollRef = useRef<number | null>(null);
  const autoScrollDirRef = useRef(0);
  useEffect(() => {
    clipDragRef.current = clipDrag;
  }, [clipDrag]);
  useEffect(
    () => () => {
      if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current);
    },
    [],
  );
  const [viewportWidth, setViewportWidth] = useState(0);
  const scale = { tempoBpm: view.tempoBpm, pixelsPerQuarter };
  // Fill the visible timeline area even when the arrangement is short, so a
  // brief clip does not leave a gaping blank region (and lanes do not clip
  // clips dragged into that space). The channel column is sticky inside the
  // scroll viewport, so subtract its width.
  const fillWidth = Math.max(0, viewportWidth - CHANNEL_PX);
  const timelineWidth = Math.max(
    240,
    fillWidth,
    ticksToPixels(view.durationTicks, scale),
  );
  const rulerDurationTicks = Math.max(
    view.durationTicks,
    pixelsToTicks(timelineWidth, scale),
  );
  const playheadLeft = ticksToPixels(props.playheadTick, scale);
  const marks = getRulerMarks({
    durationTicks: rulerDurationTicks,
    ...view.timeSignature,
  });

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    const update = () => setViewportWidth(viewport.clientWidth);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const viewport = scrollRef.current;
    const close = () => setContextMenu(null);
    const onPointerDown = (event: PointerEvent) => {
      if (
        !(event.target as Element | null)?.closest("[data-clip-context-menu]")
      )
        setContextMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", close);
    viewport?.addEventListener("scroll", close);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", close);
      viewport?.removeEventListener("scroll", close);
    };
  }, [contextMenu]);

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

  function clipDragTick(
    clientX: number,
    altKey: boolean,
    drag: { originX: number; originScrollLeft: number; startTick: number },
  ) {
    const scrollLeft = scrollRef.current?.scrollLeft ?? drag.originScrollLeft;
    const movedPixels =
      clientX - drag.originX + (scrollLeft - drag.originScrollLeft);
    const unsnapped = Math.max(
      0,
      drag.startTick + pixelsToTicks(movedPixels, scale),
    );
    return snapArrangementTick(unsnapped, altKey ? null : snapTicks);
  }

  function stopAutoScroll() {
    autoScrollDirRef.current = 0;
    if (autoScrollRef.current) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  }

  // While a clip is dragged toward either edge of the timeline viewport, scroll
  // it in that direction and keep the dragged preview under the pointer.
  function runAutoScroll() {
    autoScrollRef.current = null;
    const viewport = scrollRef.current;
    const drag = clipDragRef.current;
    if (!viewport || !drag || autoScrollDirRef.current === 0) return;
    const before = viewport.scrollLeft;
    const max = viewport.scrollWidth - viewport.clientWidth;
    const next = Math.max(
      0,
      Math.min(max, before + autoScrollDirRef.current * AUTO_SCROLL_SPEED),
    );
    if (next !== before) {
      viewport.scrollLeft = next;
      const previewTick = clipDragTick(
        dragPointerRef.current.clientX,
        dragPointerRef.current.altKey,
        drag,
      );
      setClipDrag((current) =>
        current ? { ...current, previewTick } : current,
      );
    }
    autoScrollRef.current = requestAnimationFrame(runAutoScroll);
  }

  function updateAutoScroll(clientX: number) {
    const viewport = scrollRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    autoScrollDirRef.current =
      clientX > rect.right - AUTO_SCROLL_EDGE
        ? 1
        : clientX < rect.left + CHANNEL_PX + AUTO_SCROLL_EDGE
          ? -1
          : 0;
    if (autoScrollDirRef.current !== 0 && autoScrollRef.current === null)
      autoScrollRef.current = requestAnimationFrame(runAutoScroll);
    else if (autoScrollDirRef.current === 0) stopAutoScroll();
  }

  function beginClipDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    trackId: string,
    clipId: string,
    startTick: number,
  ) {
    if (!props.editable || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelection({ kind: "clip", trackId, clipId });
    const drag = {
      trackId,
      clipId,
      pointerId: event.pointerId,
      originX: event.clientX,
      originScrollLeft: scrollRef.current?.scrollLeft ?? 0,
      startTick,
      previewTick: startTick,
      targetTrackId: trackId,
      copy: false,
    };
    clipDragRef.current = drag;
    dragPointerRef.current = { clientX: event.clientX, altKey: event.altKey };
    setClipDrag(drag);
  }

  function previewClipDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!clipDrag || clipDrag.pointerId !== event.pointerId) return;
    dragPointerRef.current = { clientX: event.clientX, altKey: event.altKey };
    const targetTrackId = findTargetTrackId(event) ?? clipDrag.trackId;
    updateAutoScroll(event.clientX);
    setClipDrag({
      ...clipDrag,
      targetTrackId,
      copy: event.ctrlKey || event.metaKey,
      previewTick: clipDragTick(event.clientX, event.altKey, clipDrag),
    });
  }

  function commitClipDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!clipDrag || clipDrag.pointerId !== event.pointerId) return;
    stopAutoScroll();
    const finalTick = clipDragTick(event.clientX, event.altKey, clipDrag);
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

  function duplicateMidiTrack(trackId: string) {
    const track = props.manifest.tracks.find(
      (candidate) => candidate.trackId === trackId,
    );
    if (track?.kind !== "midi") return;
    const newTrackId = crypto.randomUUID();
    const applied = props.onCommand({
      type: "duplicateMidiTrack",
      trackId,
      newTrackId,
      newClipIds: track.clips.map(() => crypto.randomUUID()),
    });
    if (applied) setSelection({ kind: "track", trackId: newTrackId });
  }

  function cancelClipDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!clipDrag || clipDrag.pointerId !== event.pointerId) return;
    stopAutoScroll();
    setClipDrag(null);
  }

  function seekFromRuler(event: ReactPointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
    props.onSeek(
      Math.max(0, Math.min(rulerDurationTicks, pixelsToTicks(x, scale))),
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
            Math.round((event.clientY - trackDrag.originY) / 176),
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
      className="rounded-card border-strong bg-surface flex min-h-0 flex-1 flex-col overflow-hidden border shadow-xl"
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
        if (
          selection &&
          modifier &&
          event.key.toLowerCase() === "d" &&
          selectedTrack?.kind === "midi"
        ) {
          event.preventDefault();
          duplicateMidiTrack(selection.trackId);
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
      <header className="border-subtle bg-surface-raised grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b p-3">
        <div
          className="flex min-w-0 items-center gap-3"
          aria-label="Transport position"
        >
          <p className="min-w-24 font-mono text-sm" aria-live="off">
            {formatMusicalPosition(props.playheadTick, view.timeSignature)}
          </p>
          <p className="text-muted hidden text-xs lg:block">
            {view.tempoBpm} BPM · {view.timeSignature.numerator}/
            {view.timeSignature.denominator}
          </p>
        </div>
        <button
          type="button"
          className="cta-gradient grid h-11 w-11 place-items-center rounded-full text-lg disabled:opacity-50"
          aria-label={props.playing ? "Pause arrangement" : "Play arrangement"}
          disabled={view.tracks.length === 0}
          onClick={props.onTogglePlayback}
        >
          {props.playing ? <FiPause /> : <FiPlay />}
        </button>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
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

      <div className="relative flex min-h-0 min-w-0 flex-1">
        <div
          ref={scrollRef}
          className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain"
        >
          <div
            className="relative min-w-max"
            style={{ width: timelineWidth + CHANNEL_PX }}
          >
            <div className="border-subtle bg-surface sticky top-0 z-30 grid h-11 grid-cols-[17rem_1fr] border-b">
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
                aria-valuemax={rulerDurationTicks}
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
                        rulerDurationTicks,
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
              <div className="sticky left-68 grid min-h-40 max-w-[calc(100vw-19rem)] place-items-center px-8 text-center">
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
                  return (
                    <motion.li
                      key={track.trackId}
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{
                        duration: reduce ? 0 : 0.3,
                        ease: [0.2, 0.8, 0.2, 1],
                      }}
                      className={`border-subtle grid h-44 grid-cols-[17rem_1fr] border-b ${selected ? "bg-surface-soft" : ""} ${trackDrag?.targetIndex === trackIndex || clipDrag?.targetTrackId === track.trackId ? "ring-accent ring-2 ring-inset" : ""}`}
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
                          <span className="text-accent-2 mt-1 block text-[10px] font-semibold uppercase">
                            Ready · note summary
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
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
                            className={channelButton}
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
                            className={channelButton}
                            type="button"
                            aria-label={`Move ${track.name} up`}
                            disabled={!props.editable || trackIndex === 0}
                            onClick={() => props.onMoveTrack(track.trackId, -1)}
                          >
                            <FiChevronUp />
                          </button>
                          <button
                            className={channelButton}
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
                          {track.kind === "midi" && (
                            <button
                              className={channelButton}
                              type="button"
                              aria-label={`Duplicate ${track.name}`}
                              title="Duplicate track"
                              disabled={!props.editable}
                              onClick={() => duplicateMidiTrack(track.trackId)}
                            >
                              <FiLayers />
                            </button>
                          )}
                          <button
                            className={`${channelButton} hover:border-danger hover:text-danger`}
                            type="button"
                            aria-label={`Remove ${track.name}`}
                            title="Remove track"
                            disabled={!props.editable}
                            onClick={() => props.onRemoveTrack(track.trackId)}
                          >
                            <FiTrash2 />
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
                              className={`focus-visible:ring-accent rounded-control absolute top-4 h-36 overflow-hidden border text-left focus-visible:ring-2 ${selection?.kind === "clip" && selection.clipId === clip.clipId ? "border-accent bg-accent/20" : "border-strong bg-surface-raised"}`}
                              style={{ left, width }}
                              aria-label={`MIDI clip on ${track.name}, ${formatMusicalPosition(clip.startTick, view.timeSignature)}, duration ${clip.durationTicks} ticks, credited to ${clip.creditName}.`}
                              onClick={() =>
                                setSelection({
                                  kind: "clip",
                                  trackId: track.trackId,
                                  clipId: clip.clipId,
                                })
                              }
                              onContextMenu={(event) => {
                                event.preventDefault();
                                setSelection({
                                  kind: "clip",
                                  trackId: track.trackId,
                                  clipId: clip.clipId,
                                });
                                setContextMenu({
                                  x: event.clientX,
                                  y: event.clientY,
                                });
                              }}
                              onDoubleClick={() => {
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
                              <MidiNotes
                                notes={clip.notes}
                                clipStart={clip.startTick}
                                clipDuration={clip.durationTicks}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </motion.li>
                  );
                })}
              </ol>
            ) : null}
            {props.pendingMidiLane && (
              <div className="border-accent bg-surface-soft sticky left-0 z-20 grid min-h-32 w-[min(100%,calc(100vw-2rem))] grid-cols-[17rem_minmax(30rem,1fr)] border-y border-dashed">
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
            <div className="border-subtle bg-surface sticky left-0 z-20 grid h-16 w-[min(100%,calc(100vw-2rem))] grid-cols-[17rem_minmax(30rem,1fr)] border-b">
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
              style={{ left: CHANNEL_PX + playheadLeft }}
            />
          </div>
        </div>
      </div>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {contextMenu && selectedClip && selectedTrack && (
              <motion.div
                key="clip-context-menu"
                data-clip-context-menu
                role="dialog"
                aria-label="Clip options"
                initial={
                  reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }
                }
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                transition={{
                  duration: reduce ? 0 : 0.14,
                  ease: [0.2, 0.8, 0.2, 1],
                }}
                className="border-strong bg-surface-raised rounded-card fixed z-50 max-h-[min(28rem,85vh)] w-72 origin-top-left overflow-y-auto border p-4 shadow-2xl"
                style={{
                  left: Math.max(
                    8,
                    Math.min(contextMenu.x, window.innerWidth - 296),
                  ),
                  top: Math.max(
                    8,
                    Math.min(contextMenu.y, window.innerHeight - 432),
                  ),
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-accent font-mono text-[10px] tracking-widest uppercase">
                    Clip options
                  </p>
                  <button
                    type="button"
                    className={iconButton}
                    aria-label="Close clip options"
                    title="Close"
                    onClick={() => setContextMenu(null)}
                  >
                    <FiX />
                  </button>
                </div>
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
                  onEdit={() => {
                    props.onEditMidiClip(
                      selectedTrack.trackId,
                      selectedClip.clipId,
                    );
                    setContextMenu(null);
                  }}
                  canPaste={clipboard?.kind === selectedTrack.kind}
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
                    setContextMenu(null);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
      <footer className="border-subtle bg-surface-raised flex min-h-12 flex-wrap items-center justify-between gap-3 border-t px-4 py-2">
        <p className="text-muted text-xs" aria-live="polite">
          {selection?.kind === "clip"
            ? "Clip selected · right-click for options, double-click to edit."
            : selection
              ? "Track selected · mix and reorder from its channel."
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
      className={`grid h-8 w-8 place-items-center rounded-full border text-xs font-bold ${props.active ? "bg-accent text-accent-contrast border-transparent" : "border-strong text-muted"}`}
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
  onDelete,
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
  onDelete: () => void;
}) {
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
            className={`${iconButton} text-danger`}
            aria-label="Delete selected MIDI clip"
            title="Delete selected MIDI clip"
            onClick={onDelete}
          >
            <FiTrash2 />
          </button>
        </div>
      )}
      <p className="text-muted text-[11px]">
        Clipboard data stays in this Studio session. MIDI adopts a compatible
        destination track&apos;s sound. Hold Alt while dragging for no snap.
      </p>
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
          Exact pattern version
          <select
            aria-label={`Replace ${track.name} clip version`}
            className={`${field} mt-1`}
            disabled={!editable}
            value={clip.versionId ?? ""}
            onChange={(event) => onReplace(event.target.value)}
          >
            {midiVersions.map((version) => (
              <option key={version.stemVersionId} value={version.stemVersionId}>
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
