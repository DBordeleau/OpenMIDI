"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  FiChevronDown,
  FiDisc,
  FiEdit3,
  FiCornerUpLeft,
  FiCornerUpRight,
  FiFastForward,
  FiHelpCircle,
  FiMinus,
  FiMousePointer,
  FiMusic,
  FiPlay,
  FiPlus,
  FiRadio,
  FiRewind,
  FiSkipBack,
  FiSquare,
  FiTrash2,
  FiZap,
  FiZoomIn,
  FiZoomOut,
} from "react-icons/fi";
import type { MidiNoteV1 } from "@/features/studio/manifest/v2";
import {
  canonicalizeMidiNotes,
  MAX_MIDI_NOTES_PER_STEM,
  MIDI_PPQ,
} from "@/features/studio/manifest/v2";
import {
  QUANTIZATION_TICKS,
  applyMidiStemCommand,
  type MidiStemCommand,
} from "../semantic-commands";
import type { PresetVoice } from "../browser-engine/preset-voice.client";
import {
  INSTRUMENT_PRESETS_CATALOG_1,
  resolveSynthPreset,
  SYNTH_PRESETS_V1,
} from "../presets";
import { MIDI_V3_ENGINE_VERSION } from "../domain-v3";
import {
  getMidiDraftAutosaveDelay,
  initialMidiDraftSaveState,
  reduceMidiDraftSave,
  type MidiDraftSaveStatus,
} from "./draft-autosave";
import {
  clearMidiDraftRecovery,
  readMidiDraftRecovery,
  writeMidiDraftRecovery,
  type MidiDraftRecovery,
} from "./draft-recovery.client";
import {
  createMidiEditorHistory,
  executeMidiEditorCommand,
  redoMidiEditor,
  replaceMidiEditorNotes,
  undoMidiEditor,
} from "./editor-history";
import type { MidiStemDraft } from "./types";
import {
  initialPianoScrollTop,
  isBlackPianoKey,
  midiPitchName,
  noteIntersectsPianoRollRectangle,
  pianoKeyFace,
  pianoKeyLabel,
  pianoRollSelectionRectangle,
  type PianoRollPoint,
  type PianoRollSelectionRectangle,
  PIANO_KEY_WIDTH as BASE_KEY_WIDTH,
  PITCH_ROW_HEIGHT as BASE_ROW_HEIGHT,
} from "./piano-roll";
import { useMidiPerformance } from "./use-midi-performance.client";

export type MidiStemEditorHost = {
  tempoBpm: number;
  timeSignature: { numerator: number; denominator: number };
  onTransportStart: (countInSeconds: number) => void;
  onPlaybackTransportStart: (
    editorStartTick: number,
    countInSeconds: number,
  ) => void;
  onTransportStop: () => void;
  onDraftStatusChange: (status: MidiDraftSaveStatus) => void;
  persistDraft?: (content: {
    name: string;
    defaultPresetId: string;
    defaultPresetVersion: 1;
    ppq: 480;
    durationTicks: number;
    notes: MidiNoteV1[];
  }) => Promise<{
    ok: boolean;
    lockVersion: number;
    contentSha256: string;
  }>;
  finalize: (input: {
    draftId: string;
    expectedLockVersion: number;
    expectedContentSha256: string;
    content: {
      name: string;
      presetId: string;
      presetVersion: 1;
      ppq: 480;
      durationTicks: number;
      notes: MidiNoteV1[];
    };
  }) => Promise<{ ok: boolean; message: string }>;
  finalizeLabel: string;
  onClose: () => void;
};
const MIN_PIXELS_PER_BEAT = 48;
const MAX_PIXELS_PER_BEAT = 160;
const DEFAULT_PIXELS_PER_BEAT = 88;
const MIN_NOTE_WIDTH = 7;
const RESIZE_HANDLE_WIDTH = 10;

const inputClass =
  "focus:border-accent border-strong bg-surface mt-2 min-h-11 w-full rounded-control border px-3 py-2 transition-colors";
// Compact variants for the single-line editor header. Kept separate from
// `inputClass` so the margin/padding utilities never collide.
const fieldClass =
  "focus:border-accent border-strong bg-surface min-h-10 w-full rounded-control border px-3 text-sm transition-colors";
const selectFieldClass =
  "focus:border-accent border-strong bg-surface min-h-10 w-full rounded-control border py-1.5 pr-3 pl-9 text-sm font-semibold transition-colors";
const transportButton =
  "border-strong text-muted hover:border-accent hover:text-accent grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-40";
// Hold-to-scrub: a tap steps one bar, holding past the delay sweeps the
// playhead at a steady musical rate.
const SEEK_HOLD_DELAY_MS = 300;
const SEEK_HOLD_BEATS_PER_SECOND = 6;
const secondaryButton =
  "border-strong hover:border-accent inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold disabled:opacity-45";

type Quantization = keyof typeof QUANTIZATION_TICKS;
type EditorTool = "pencil" | "select";
type Viewport = {
  width: number;
  height: number;
  scrollLeft: number;
  scrollTop: number;
};
type DragGesture = {
  mode: "move" | "resize" | "copy";
  pointerId: number;
  clientX: number;
  clientY: number;
  noteIds: readonly string[];
  notes: readonly MidiNoteV1[];
  lastAuditionPitch: number;
  auditionNoteId: string;
  copyIds: readonly string[];
  previewNotes: readonly MidiNoteV1[] | null;
};

type MarqueeGesture = {
  pointerId: number;
  clientX: number;
  clientY: number;
  start: PianoRollPoint;
  current: PianoRollPoint;
  initialSelection: ReadonlySet<string>;
  additive: boolean;
  moved: boolean;
};

type PianoGesture = {
  pointerId: number;
  pitch: number;
  source: string;
};

type PerformanceKeyGesture = {
  pointerId: number;
  pitch: number;
  source: string;
};

type AuditionVoice = {
  presetId: string;
  voice: PresetVoice;
};

function formatStemPosition(tick: number, beatsPerBar: number) {
  const beatIndex = Math.floor(Math.max(0, tick) / MIDI_PPQ);
  return `${Math.floor(beatIndex / beatsPerBar) + 1}.${(beatIndex % beatsPerBar) + 1}`;
}

/** Bar.beat.sixteenth for the inspector's Start field (1-indexed). */
function formatTickPosition(tick: number, beatsPerBar: number) {
  const safe = Math.max(0, tick);
  const beatIndex = Math.floor(safe / MIDI_PPQ);
  const sixteenth = Math.floor((safe % MIDI_PPQ) / (MIDI_PPQ / 4)) + 1;
  return `${Math.floor(beatIndex / beatsPerBar) + 1}.${(beatIndex % beatsPerBar) + 1}.${sixteenth}`;
}

/** Note length as a musical fraction where it lands cleanly, else in beats. */
function formatTickLength(ticks: number) {
  const named: Record<number, string> = {
    [MIDI_PPQ * 4]: "1 bar",
    [MIDI_PPQ * 2]: "1/2",
    [MIDI_PPQ]: "1/4",
    [MIDI_PPQ / 2]: "1/8",
    [MIDI_PPQ / 4]: "1/16",
    [MIDI_PPQ / 8]: "1/32",
    [(MIDI_PPQ * 3) / 2]: "3/8",
    [(MIDI_PPQ * 3) / 4]: "3/16",
  };
  if (named[ticks]) return named[ticks];
  const beats = ticks / MIDI_PPQ;
  return beats >= 1 ? `${Number(beats.toFixed(2))} beats` : `${ticks} ticks`;
}

function resizeHandleWidth(noteWidth: number) {
  return Math.min(RESIZE_HANDLE_WIDTH, Math.max(4, noteWidth / 3));
}

function selectedValues(event: React.ChangeEvent<HTMLSelectElement>) {
  return new Set(
    Array.from(event.currentTarget.selectedOptions, (option) => option.value),
  );
}

function contentFingerprint(input: {
  name: string;
  presetId: string;
  notes: readonly MidiNoteV1[];
}) {
  return JSON.stringify(input);
}

export function MidiStemEditor({
  draft,
  host,
}: {
  draft: MidiStemDraft;
  host?: MidiStemEditorHost;
}) {
  const [name, setName] = useState(draft.name);
  const [presetId, setPresetId] = useState(draft.defaultPresetId);
  const [history, setHistory] = useState(() =>
    createMidiEditorHistory(draft.notes),
  );
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(draft.notes[0] ? [draft.notes[0].noteId] : []),
  );
  const [previewNotes, setPreviewNotes] = useState<
    readonly MidiNoteV1[] | null
  >(null);
  const [quantization, setQuantization] = useState<Quantization>("1/16");
  const [editorTool, setEditorTool] = useState<EditorTool>("pencil");
  const [pixelsPerBeat, setPixelsPerBeat] = useState(DEFAULT_PIXELS_PER_BEAT);
  const [uiScale, setUiScale] = useState(1);
  const [viewport, setViewport] = useState<Viewport>({
    width: 900,
    height: 430,
    scrollLeft: 0,
    scrollTop: 0,
  });
  const [showShortcuts, setShowShortcuts] = useState(false);
  // Velocity-lane stem being dragged, with its uncommitted preview value; the
  // command commits once on release so history stays one entry per gesture.
  const [velocityDrag, setVelocityDrag] = useState<{
    noteId: string;
    velocity: number;
  } | null>(null);
  // The recorder starts collapsed so the piano roll owns the vertical space;
  // one click on "Perform a take" expands it when a take is wanted.
  const [performOpen, setPerformOpen] = useState(false);
  const reduce = useReducedMotion();
  const [notice, setNotice] = useState("");
  const [recovery, setRecovery] = useState<MidiDraftRecovery | null>(null);
  const [saveState, dispatchSave] = useReducer(
    reduceMidiDraftSave,
    initialMidiDraftSaveState,
  );
  const [playing, setPlaying] = useState(false);
  const [playheadTick, setPlayheadTick] = useState(0);
  const [publicationState, setPublicationState] = useState<
    | { status: "idle"; message: string }
    | { status: "publishing"; message: string }
    | { status: "published"; message: string }
    | { status: "error"; message: string }
  >({ status: "idle", message: "" });
  const rollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const performanceKeyboardRef = useRef<HTMLDivElement>(null);
  const lockVersionRef = useRef(draft.lockVersion);
  const contentSha256Ref = useRef(draft.contentSha256);
  const savingRef = useRef(false);
  const dirtySinceRef = useRef<number | null>(null);
  const editGenerationRef = useRef(0);
  const [editGeneration, setEditGeneration] = useState(0);
  const saveStatusRef = useRef<MidiDraftSaveStatus>(saveState.status);
  const gestureRef = useRef<DragGesture | null>(null);
  const marqueeGestureRef = useRef<MarqueeGesture | null>(null);
  const [marquee, setMarquee] = useState<PianoRollSelectionRectangle | null>(
    null,
  );
  const noteClipboardRef = useRef<readonly MidiNoteV1[]>([]);
  const pianoGestureRef = useRef<PianoGesture | null>(null);
  const performanceKeyGestureRef = useRef<PerformanceKeyGesture | null>(null);
  const initialViewportRef = useRef(false);
  const voiceRef = useRef<PresetVoice | null>(null);
  const auditionVoiceRef = useRef<AuditionVoice | null>(null);
  const auditionHeldPitchesRef = useRef(new Set<number>());
  const auditionRequestRef = useRef(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playheadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seekHoldRef = useRef<{
    timeout: ReturnType<typeof setTimeout> | null;
    frame: number | null;
    repeated: boolean;
  }>({ timeout: null, frame: null, repeated: false });

  const notes = previewNotes ?? history.notes;
  const preset = resolveSynthPreset(
    presetId,
    1,
    host ? MIDI_V3_ENGINE_VERSION : undefined,
  );
  const selectedNotes = useMemo(
    () => history.notes.filter(({ noteId }) => selectedIds.has(noteId)),
    [history.notes, selectedIds],
  );
  const selectedNote = selectedNotes.length === 1 ? selectedNotes[0] : null;
  const pitchCount = preset.maxNote - preset.minNote + 1;
  // The piano roll's key width and row height scale with the studio's fluid
  // rem (html[data-studio-scale]) so the grid grows on large displays like the
  // rest of the DAW instead of staying tiny. In jsdom the root stays 16px, so
  // the factor is 1 and all pixel/hit-test math is unchanged for tests.
  const rowH = BASE_ROW_HEIGHT * uiScale;
  const keyW = BASE_KEY_WIDTH * uiScale;
  const rollHeight = pitchCount * rowH;
  const timelineWidth = Math.max(
    viewport.width - keyW,
    (draft.durationTicks / MIDI_PPQ) * pixelsPerBeat,
  );
  const rollWidth = keyW + timelineWidth;

  useEffect(() => {
    saveStatusRef.current = saveState.status;
    host?.onDraftStatusChange(saveState.status);
  }, [host, saveState.status]);

  useEffect(() => {
    const local = readMidiDraftRecovery(draft.ownerId, draft.draftId);
    let timer: number | null = null;
    if (
      local &&
      local.serverLockVersion === draft.lockVersion &&
      contentFingerprint({
        name: local.content.name,
        presetId: local.content.defaultPresetId,
        notes: local.content.notes,
      }) !== contentFingerprint({ name, presetId, notes: history.notes })
    ) {
      timer = window.setTimeout(() => setRecovery(local), 0);
    }
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
    // Recovery is intentionally inspected only against the server snapshot at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.draftId, draft.lockVersion, draft.ownerId]);

  const markEdited = useCallback(() => {
    if (saveStatusRef.current === "conflict") return;
    dirtySinceRef.current ??= Date.now();
    editGenerationRef.current += 1;
    setEditGeneration(editGenerationRef.current);
    dispatchSave({ type: "edit" });
    setPublicationState({ status: "idle", message: "" });
  }, []);

  const stopPlayback = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (playheadTimerRef.current) clearInterval(playheadTimerRef.current);
    stopTimerRef.current = null;
    playheadTimerRef.current = null;
    voiceRef.current?.allNotesOff();
    voiceRef.current?.dispose();
    voiceRef.current = null;
    setPlaying(false);
    host?.onTransportStop();
  }, [host]);

  const stopAudition = useCallback(() => {
    auditionRequestRef.current += 1;
    auditionHeldPitchesRef.current.clear();
    auditionVoiceRef.current?.voice.allNotesOff();
    auditionVoiceRef.current?.voice.dispose();
    auditionVoiceRef.current = null;
  }, []);

  const auditionNote = useCallback(
    async (pitch: number, velocity = 96) => {
      auditionHeldPitchesRef.current.add(pitch);
      const request = ++auditionRequestRef.current;
      try {
        const { createPresetVoice, resumeMidiAudioContext } =
          await import("../browser-engine/preset-voice.client");
        const when = await resumeMidiAudioContext();
        let entry = auditionVoiceRef.current;
        if (!entry || entry.presetId !== presetId) {
          entry?.voice.dispose();
          const voice = await createPresetVoice(presetId, 1);
          if (request !== auditionRequestRef.current) {
            voice.dispose();
            return;
          }
          entry = { presetId, voice };
          auditionVoiceRef.current = entry;
        }
        if (!auditionHeldPitchesRef.current.has(pitch)) return;
        entry.voice.triggerAttack(pitch, when, velocity / 127);
      } catch {
        // Audition is a progressive enhancement; editing remains available when
        // the browser has not granted audio playback yet.
      }
    },
    [presetId],
  );

  const releaseAuditionNote = useCallback((pitch: number) => {
    auditionHeldPitchesRef.current.delete(pitch);
    auditionVoiceRef.current?.voice.triggerRelease(pitch);
  }, []);

  const commitRecordedTake = useCallback(
    (recordedNotes: readonly MidiNoteV1[]) => {
      const noteIds = recordedNotes.map(({ noteId }) => noteId);
      if (
        history.notes.length + recordedNotes.length >
        MAX_MIDI_NOTES_PER_STEM
      ) {
        setNotice("That take would exceed the 2,048-note stem limit.");
        return;
      }
      setHistory(
        replaceMidiEditorNotes(
          history,
          canonicalizeMidiNotes([...history.notes, ...recordedNotes]),
        ),
      );
      setSelectedIds(new Set(noteIds));
      setNotice(
        `Recorded ${recordedNotes.length} ${recordedNotes.length === 1 ? "note" : "notes"} as one undoable take.`,
      );
      markEdited();
    },
    [history, markEdited],
  );

  const performance = useMidiPerformance({
    durationTicks: draft.durationTicks,
    minPitch: preset.minNote,
    maxPitch: preset.maxNote,
    existingNoteCount: history.notes.length,
    audition: (pitch, velocity) => void auditionNote(pitch, velocity),
    releaseAudition: releaseAuditionNote,
    commitTake: commitRecordedTake,
    announce: setNotice,
    bpm: host?.tempoBpm,
    beatsPerBar: host?.timeSignature.numerator,
    onTransportStart: host?.onTransportStart,
    onTransportStop: host?.onTransportStop,
  });
  const visiblePlayheadTick =
    performance.status === "idle" ? playheadTick : performance.playheadTick;
  const beatsPerBar = host?.timeSignature.numerator ?? 4;
  const barTicks = MIDI_PPQ * beatsPerBar;
  const performancePitches = useMemo(() => {
    const base = (performance.octave + 1) * 12;
    return Array.from({ length: 13 }, (_, offset) => base + offset).filter(
      (pitch) => pitch >= preset.minNote && pitch <= preset.maxNote,
    );
  }, [performance.octave, preset.maxNote, preset.minNote]);

  useEffect(() => {
    const clearPerformanceGesture = () => {
      performanceKeyGestureRef.current = null;
    };
    const clearHiddenGesture = () => {
      if (document.visibilityState === "hidden") clearPerformanceGesture();
    };
    window.addEventListener("blur", clearPerformanceGesture);
    document.addEventListener("visibilitychange", clearHiddenGesture);
    return () => {
      window.removeEventListener("blur", clearPerformanceGesture);
      document.removeEventListener("visibilitychange", clearHiddenGesture);
    };
  }, []);

  useEffect(() => stopPlayback, [stopPlayback]);
  useEffect(() => stopAudition, [stopAudition]);
  useEffect(() => {
    const hold = seekHoldRef.current;
    return () => {
      if (hold.timeout) clearTimeout(hold.timeout);
      if (hold.frame !== null) cancelAnimationFrame(hold.frame);
    };
  }, []);

  const commitCommand = useCallback(
    (
      command: MidiStemCommand,
      message: string,
      nextSelection?: readonly string[],
    ) => {
      try {
        const next = executeMidiEditorCommand(
          history,
          draft.durationTicks,
          command,
        );
        if (
          next.notes.some(
            (note) =>
              note.pitch < preset.minNote || note.pitch > preset.maxNote,
          )
        ) {
          setNotice(`Keep notes inside ${preset.name}'s playable range.`);
          return;
        }
        setHistory(next);
        if (nextSelection) setSelectedIds(new Set(nextSelection));
        setNotice(message);
        markEdited();
      } catch {
        setNotice(
          "That edit would move a note outside this stem or sound range.",
        );
      }
    },
    [draft.durationTicks, history, markEdited, preset],
  );

  const performSave = useCallback(async () => {
    if (savingRef.current || saveStatusRef.current === "conflict") return;
    if (!navigator.onLine) {
      dispatchSave({ type: "offline" });
      return;
    }
    savingRef.current = true;
    dispatchSave({ type: "save" });
    const generation = editGenerationRef.current;
    const content = {
      name,
      defaultPresetId: presetId,
      defaultPresetVersion: 1 as const,
      ppq: MIDI_PPQ,
      durationTicks: draft.durationTicks,
      notes: [...history.notes],
    };
    try {
      const result = host?.persistDraft
        ? await host.persistDraft(content)
        : { ok: false, lockVersion: 0, contentSha256: "" };
      if (!result.ok) {
        dispatchSave({
          type: "error",
        });
        return;
      }
      lockVersionRef.current = result.lockVersion;
      contentSha256Ref.current = result.contentSha256;
      if (generation === editGenerationRef.current) {
        dirtySinceRef.current = null;
        clearMidiDraftRecovery(draft.ownerId, draft.draftId);
        dispatchSave({ type: "saved" });
      } else {
        dispatchSave({ type: "edit" });
        setEditGeneration(editGenerationRef.current);
      }
    } catch {
      dispatchSave({ type: navigator.onLine ? "error" : "offline" });
    } finally {
      savingRef.current = false;
    }
  }, [
    draft.draftId,
    draft.durationTicks,
    draft.ownerId,
    history.notes,
    name,
    presetId,
    host,
  ]);

  useEffect(() => {
    if (!dirtySinceRef.current) return;
    writeMidiDraftRecovery({
      version: 1,
      ownerId: draft.ownerId,
      draftId: draft.draftId,
      serverLockVersion: lockVersionRef.current,
      savedAt: new Date().toISOString(),
      state: saveState.status === "conflict" ? "conflict" : "pending",
      content: {
        name,
        defaultPresetId: presetId,
        defaultPresetVersion: 1,
        ppq: MIDI_PPQ,
        durationTicks: draft.durationTicks,
        notes: [...history.notes],
      },
    });
  }, [
    draft.draftId,
    draft.durationTicks,
    draft.ownerId,
    editGeneration,
    history.notes,
    name,
    presetId,
    saveState.status,
  ]);

  useEffect(() => {
    if (saveState.status !== "unsaved") return;
    const timer = window.setTimeout(
      () => void performSave(),
      getMidiDraftAutosaveDelay(
        dirtySinceRef.current ?? Date.now(),
        Date.now(),
      ),
    );
    return () => window.clearTimeout(timer);
  }, [editGeneration, performSave, saveState.status]);

  useEffect(() => {
    const online = () => {
      if (dirtySinceRef.current && saveStatusRef.current !== "conflict") {
        dispatchSave({ type: "edit" });
        setEditGeneration(editGenerationRef.current);
      }
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtySinceRef.current) return;
      event.preventDefault();
    };
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, []);

  useEffect(() => {
    const measure = () => {
      const px =
        Number.parseFloat(
          getComputedStyle(document.documentElement).fontSize,
        ) || 16;
      setUiScale(px / 16);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const roll = rollRef.current;
    if (!roll) return;
    const update = () => {
      const width = roll.clientWidth;
      const height = roll.clientHeight;
      let scrollTop = roll.scrollTop;
      if (!initialViewportRef.current && height > 0) {
        scrollTop =
          scrollTop ||
          initialPianoScrollTop({
            minPitch: preset.minNote,
            maxPitch: preset.maxNote,
            viewportHeight: height,
            rowHeight: BASE_ROW_HEIGHT * uiScale,
          });
        roll.scrollTop = scrollTop;
        initialViewportRef.current = true;
      }
      setViewport((current) => ({
        ...current,
        width,
        height,
        scrollTop,
      }));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(roll);
    return () => observer.disconnect();
  }, [preset.maxNote, preset.minNote, uiScale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(viewport.width * scale));
    canvas.height = Math.max(1, Math.floor(viewport.height * scale));
    context.setTransform(scale, 0, 0, scale, 0, 0);
    const css = getComputedStyle(canvas);
    const color = (token: string, fallback: string) =>
      css.getPropertyValue(token).trim() || fallback;
    const canvasColor = color("--color-canvas", "#160f1a");
    const borderColor = color("--color-border", "rgba(255,255,255,.1)");
    const strongBorder = color(
      "--color-border-strong",
      "rgba(255,255,255,.16)",
    );
    const mutedColor = color("--color-text-muted", "#b8abbc");
    const accent = color("--color-accent", "#ff8d63");
    const accent2 = color("--color-accent-2", "#ffc879");
    // Warm the roll base with a soft coral→plum vertical wash so the grid
    // glows like the mockup rather than reading as flat cool purple.
    const base = context.createLinearGradient(0, 0, 0, viewport.height);
    base.addColorStop(0, "#1f1320");
    base.addColorStop(1, "#160e17");
    context.fillStyle = base;
    context.fillRect(0, 0, viewport.width, viewport.height);

    const firstRow = Math.max(0, Math.floor(viewport.scrollTop / rowH));
    const lastRow = Math.min(
      pitchCount,
      Math.ceil((viewport.scrollTop + viewport.height) / rowH),
    );
    context.font = `${Math.round(11 * uiScale)}px ui-monospace, monospace`;
    context.textBaseline = "middle";
    const laneWidth = viewport.width - keyW;
    for (let row = firstRow; row < lastRow; row += 1) {
      const pitch = preset.maxNote - row;
      const y = row * rowH - viewport.scrollTop;
      const isBlack = isBlackPianoKey(pitch);
      const pitchClass = ((pitch % 12) + 12) % 12;
      const isC = pitchClass === 0;
      // Layered lane shading (five tones like the approved mockup): black-key
      // rows sit darkest, white-key rows alternate a faint warm band per
      // octave, and every C row carries a gold wash so octaves read at a glance.
      const octaveWarm = Math.floor(pitch / 12) % 2 === 0;
      context.fillStyle = isBlack
        ? octaveWarm
          ? "#221530"
          : "#1c1128"
        : octaveWarm
          ? "#31213f"
          : "#2a1b37";
      context.fillRect(keyW, y, laneWidth, rowH);
      // Warm coral→gold wash bands every octave so the grid glows like the
      // mockup instead of reading as flat dark plum.
      context.fillStyle = octaveWarm
        ? "rgba(255,141,99,.06)"
        : "rgba(255,200,121,.035)";
      context.fillRect(keyW, y, laneWidth, rowH);
      if (isC) {
        context.fillStyle = "rgba(255,200,121,.11)";
        context.fillRect(keyW, y, laneWidth, rowH);
      }
      context.strokeStyle = isC ? "rgba(255,255,255,.14)" : borderColor;
      context.beginPath();
      context.moveTo(keyW, y + rowH);
      context.lineTo(viewport.width, y + rowH);
      context.stroke();

      const face = pianoKeyFace(pitch);
      const blackFaceWidth = face.width * uiScale;
      const active = performance.activePitches.has(pitch);
      if (isBlack) {
        // White backing for the whole key row, then a shorter dark plum key
        // laid over it — so a black key reads as sitting between its white
        // neighbours, never as a mauve smear.
        context.fillStyle = "#efe6dd";
        context.fillRect(0, y, keyW, rowH);
        context.strokeStyle = "rgba(0,0,0,.22)";
        context.strokeRect(0, y + 0.5, keyW, rowH);
        const blackKey = context.createLinearGradient(0, y, blackFaceWidth, y);
        if (active) {
          blackKey.addColorStop(0, accent);
          blackKey.addColorStop(1, "#ff7a4d");
          context.shadowColor = accent;
          context.shadowBlur = 10;
        } else {
          blackKey.addColorStop(0, "#241826");
          blackKey.addColorStop(0.7, "#33223a");
          blackKey.addColorStop(1, "#1a1120");
        }
        context.fillStyle = blackKey;
        context.beginPath();
        context.roundRect(
          0,
          y + face.insetY,
          blackFaceWidth,
          rowH - face.insetY * 2,
          [0, 4, 4, 0],
        );
        context.fill();
        context.shadowBlur = 0;
      } else {
        const whiteKey = context.createLinearGradient(0, y, keyW, y);
        if (active) {
          whiteKey.addColorStop(0, accent2);
          whiteKey.addColorStop(1, "#ffe0b0");
          context.shadowColor = accent2;
          context.shadowBlur = 10;
        } else {
          whiteKey.addColorStop(0, "#e4dad1");
          whiteKey.addColorStop(0.55, "#f7efe9");
          whiteKey.addColorStop(1, "#fdf8f3");
        }
        context.fillStyle = whiteKey;
        context.fillRect(0, y, keyW, rowH);
        context.shadowBlur = 0;
        context.strokeStyle = "rgba(0,0,0,.18)";
        context.beginPath();
        context.moveTo(0, y + rowH - 0.5);
        context.lineTo(keyW, y + rowH - 0.5);
        context.stroke();
      }
      context.fillStyle = active ? "#2a1310" : isBlack ? "#efe6dd" : "#6d5a52";
      context.textAlign = "right";
      context.fillText(pianoKeyLabel(pitch) ?? "", keyW - 7, y + rowH / 2);
      context.textAlign = "left";
    }
    context.fillStyle = strongBorder;
    context.fillRect(keyW - 1, 0, 2, viewport.height);

    const visibleStartTick = Math.max(
      0,
      ((viewport.scrollLeft - keyW) / pixelsPerBeat) * MIDI_PPQ,
    );
    // The grid, beat lines, and bar numbers run across the whole visible
    // roll — past the clip's end — so a short clip never trails into a
    // featureless void. Notes themselves stay bounded by the clip data.
    const visibleEndTick =
      ((viewport.scrollLeft + viewport.width) / pixelsPerBeat) * MIDI_PPQ;
    const grid = QUANTIZATION_TICKS[quantization];
    const firstGrid = Math.floor(visibleStartTick / grid) * grid;
    for (let tick = firstGrid; tick <= visibleEndTick; tick += grid) {
      const x = keyW + (tick / MIDI_PPQ) * pixelsPerBeat - viewport.scrollLeft;
      const isBar = tick % (MIDI_PPQ * 4) === 0;
      const isBeat = tick % MIDI_PPQ === 0;
      context.strokeStyle = isBar
        ? strongBorder
        : isBeat
          ? borderColor
          : "rgba(255,255,255,.045)";
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, viewport.height);
      context.stroke();
      if (isBar) {
        context.fillStyle = mutedColor;
        context.fillText(
          String(Math.floor(tick / (MIDI_PPQ * 4)) + 1),
          x + 4,
          10,
        );
      }
    }

    for (const note of notes) {
      const noteEnd = note.startTick + note.durationTicks;
      if (noteEnd < visibleStartTick || note.startTick > visibleEndTick)
        continue;
      const row = preset.maxNote - note.pitch;
      const y = row * rowH - viewport.scrollTop + 3;
      if (y > viewport.height || y + rowH < 0) continue;
      const x =
        keyW +
        (note.startTick / MIDI_PPQ) * pixelsPerBeat -
        viewport.scrollLeft;
      const width = Math.max(
        MIN_NOTE_WIDTH,
        (note.durationTicks / MIDI_PPQ) * pixelsPerBeat,
      );
      // Gold pills with velocity as opacity; the selection reads as coral
      // plus a ring, matching the landing-page diff vocabulary.
      const noteSelected = selectedIds.has(note.noteId);
      context.fillStyle = noteSelected ? accent : accent2;
      context.globalAlpha = 0.45 + (note.velocity / 127) * 0.55;
      context.beginPath();
      context.roundRect(x, y, width, rowH - 6, 4);
      context.fill();
      context.globalAlpha = 1;
      const handleWidth = resizeHandleWidth(width);
      context.globalAlpha = 0.4;
      context.fillStyle = canvasColor;
      context.beginPath();
      context.roundRect(
        x + width - handleWidth,
        y + 2,
        Math.max(2, handleWidth - 2),
        rowH - 10,
        2,
      );
      context.fill();
      context.globalAlpha = 1;
      if (noteSelected) {
        context.strokeStyle = accent;
        context.lineWidth = 1.5;
        context.beginPath();
        context.roundRect(x - 0.75, y - 0.75, width + 1.5, rowH - 4.5, 5);
        context.stroke();
        context.lineWidth = 1;
      }
    }

    if (marquee) {
      const x =
        keyW +
        (marquee.startTick / MIDI_PPQ) * pixelsPerBeat -
        viewport.scrollLeft;
      const endX =
        keyW +
        (marquee.endTick / MIDI_PPQ) * pixelsPerBeat -
        viewport.scrollLeft;
      const y = (preset.maxNote - marquee.maxPitch) * rowH - viewport.scrollTop;
      const height = (marquee.maxPitch - marquee.minPitch + 1) * rowH;
      context.fillStyle = accent2;
      context.globalAlpha = 0.18;
      context.fillRect(x, y, Math.max(1, endX - x), height);
      context.globalAlpha = 1;
      context.strokeStyle = accent2;
      context.lineWidth = 1;
      context.strokeRect(x, y, Math.max(1, endX - x), height);
    }

    const playheadX =
      keyW +
      (visiblePlayheadTick / MIDI_PPQ) * pixelsPerBeat -
      viewport.scrollLeft;
    context.strokeStyle = accent;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(playheadX, 0);
    context.lineTo(playheadX, viewport.height);
    context.stroke();
  }, [
    draft.durationTicks,
    marquee,
    notes,
    performance.activePitches,
    pixelsPerBeat,
    pitchCount,
    visiblePlayheadTick,
    preset.drumMap,
    preset.maxNote,
    quantization,
    selectedIds,
    viewport,
    rowH,
    keyW,
    uiScale,
  ]);

  function noteAtPointer(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const worldX = clientX - rect.left + viewport.scrollLeft - keyW;
    const worldY = clientY - rect.top + viewport.scrollTop;
    for (const note of [...history.notes].reverse()) {
      const x = (note.startTick / MIDI_PPQ) * pixelsPerBeat;
      const width = Math.max(
        MIN_NOTE_WIDTH,
        (note.durationTicks / MIDI_PPQ) * pixelsPerBeat,
      );
      const y = (preset.maxNote - note.pitch) * rowH;
      if (
        worldX >= x &&
        worldX <= x + width &&
        worldY >= y &&
        worldY <= y + rowH
      ) {
        return {
          note,
          resize: worldX >= x + width - resizeHandleWidth(width),
        };
      }
    }
    return null;
  }

  function pitchAtPointer(clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return preset.minNote;
    const row = Math.floor((clientY - rect.top + viewport.scrollTop) / rowH);
    return Math.max(
      preset.minNote,
      Math.min(preset.maxNote, preset.maxNote - row),
    );
  }

  function rollPointAtPointer(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { tick: 0, pitch: preset.minNote };
    const tick = Math.max(
      0,
      Math.min(
        draft.durationTicks,
        Math.round(
          ((clientX - rect.left + viewport.scrollLeft - keyW) / pixelsPerBeat) *
            MIDI_PPQ,
        ),
      ),
    );
    return { tick, pitch: pitchAtPointer(clientY) };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX - rect.left < keyW) {
      const pitch = pitchAtPointer(event.clientY);
      const source = `piano-gutter:${event.pointerId}`;
      event.currentTarget.setPointerCapture(event.pointerId);
      pianoGestureRef.current = { pointerId: event.pointerId, pitch, source };
      performance.previewOn(pitch, performance.defaultVelocity, source);
      return;
    }
    const hit = noteAtPointer(event.clientX, event.clientY);
    if (!hit) {
      if (editorTool === "select") {
        const point = rollPointAtPointer(event.clientX, event.clientY);
        const initialSelection = new Set(selectedIds);
        const gesture: MarqueeGesture = {
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          start: point,
          current: point,
          initialSelection,
          additive: event.shiftKey,
          moved: false,
        };
        marqueeGestureRef.current = gesture;
        setMarquee(pianoRollSelectionRectangle(point, point));
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.style.cursor = "crosshair";
      } else if (!event.shiftKey) {
        setSelectedIds(new Set());
      }
      return;
    }
    const nextSelection = new Set(selectedIds);
    if (event.shiftKey) {
      if (nextSelection.has(hit.note.noteId))
        nextSelection.delete(hit.note.noteId);
      else nextSelection.add(hit.note.noteId);
    } else if (!nextSelection.has(hit.note.noteId)) {
      nextSelection.clear();
      nextSelection.add(hit.note.noteId);
    }
    setSelectedIds(nextSelection);
    if (!nextSelection.has(hit.note.noteId)) return;
    const modifier = event.ctrlKey || event.metaKey;
    if (
      modifier &&
      history.notes.length + nextSelection.size > MAX_MIDI_NOTES_PER_STEM
    ) {
      setNotice("Copy-dragging that selection would exceed 2,048 notes.");
      return;
    }
    const mode = modifier ? "copy" : hit.resize ? "resize" : "move";
    const noteIds = [...nextSelection];
    const copyIds =
      mode === "copy" ? noteIds.map(() => crypto.randomUUID()) : [];
    const grabbedNoteIndex = noteIds.indexOf(hit.note.noteId);
    event.currentTarget.setPointerCapture(event.pointerId);
    gestureRef.current = {
      mode,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      noteIds,
      notes: history.notes,
      lastAuditionPitch: hit.note.pitch,
      auditionNoteId:
        mode === "copy" ? copyIds[grabbedNoteIndex] : hit.note.noteId,
      copyIds,
      previewNotes: null,
    };
    event.currentTarget.style.cursor =
      mode === "copy" ? "copy" : mode === "resize" ? "ew-resize" : "grabbing";
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const pianoGesture = pianoGestureRef.current;
    if (pianoGesture?.pointerId === event.pointerId) {
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX - rect.left >= keyW) {
        finishPianoGesture(event);
        return;
      }
      const pitch = pitchAtPointer(event.clientY);
      if (pitch !== pianoGesture.pitch) {
        pianoGesture.pitch = pitch;
        performance.previewOn(
          pitch,
          performance.defaultVelocity,
          pianoGesture.source,
        );
      }
      return;
    }
    const marqueeGesture = marqueeGestureRef.current;
    if (marqueeGesture?.pointerId === event.pointerId) {
      const point = rollPointAtPointer(event.clientX, event.clientY);
      marqueeGesture.current = point;
      marqueeGesture.moved ||=
        Math.abs(event.clientX - marqueeGesture.clientX) > 2 ||
        Math.abs(event.clientY - marqueeGesture.clientY) > 2;
      const rectangle = pianoRollSelectionRectangle(
        marqueeGesture.start,
        point,
      );
      const intersected = history.notes
        .filter((note) => noteIntersectsPianoRollRectangle(note, rectangle))
        .map(({ noteId }) => noteId);
      const nextSelection = marqueeGesture.additive
        ? new Set(marqueeGesture.initialSelection)
        : new Set<string>();
      for (const noteId of intersected) {
        if (
          marqueeGesture.additive &&
          marqueeGesture.initialSelection.has(noteId)
        )
          nextSelection.delete(noteId);
        else nextSelection.add(noteId);
      }
      setSelectedIds(nextSelection);
      setMarquee(rectangle);
      event.currentTarget.style.cursor = "crosshair";
      return;
    }
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX - rect.left < keyW) {
        event.currentTarget.style.cursor = "pointer";
        return;
      }
      const hit = noteAtPointer(event.clientX, event.clientY);
      event.currentTarget.style.cursor = hit
        ? hit.resize
          ? "ew-resize"
          : "grab"
        : "crosshair";
      return;
    }
    event.currentTarget.style.cursor =
      gesture.mode === "copy"
        ? "copy"
        : gesture.mode === "resize"
          ? "ew-resize"
          : "grabbing";
    const grid = QUANTIZATION_TICKS[quantization];
    const rawDeltaTicks = Math.round(
      ((event.clientX - gesture.clientX) / pixelsPerBeat) * MIDI_PPQ,
    );
    const deltaTicks = event.altKey
      ? rawDeltaTicks
      : Math.round(rawDeltaTicks / grid) * grid;
    const deltaPitch = -Math.round((event.clientY - gesture.clientY) / rowH);
    try {
      const command: MidiStemCommand =
        gesture.mode === "resize"
          ? { type: "resizeNotes", noteIds: gesture.noteIds, deltaTicks }
          : gesture.mode === "copy"
            ? {
                type: "duplicateNotes",
                noteIds: gesture.noteIds,
                copies: gesture.noteIds.map((noteId, index) => {
                  const source = gesture.notes.find(
                    (note) => note.noteId === noteId,
                  );
                  if (!source) throw new Error("Copied note is unavailable");
                  return {
                    ...source,
                    noteId: gesture.copyIds[index],
                    startTick: source.startTick + deltaTicks,
                    pitch: source.pitch + deltaPitch,
                  };
                }),
              }
            : {
                type: "moveNotes",
                noteIds: gesture.noteIds,
                deltaTicks,
                deltaPitch,
              };
      const next = applyMidiStemCommand(
        { durationTicks: draft.durationTicks, notes: gesture.notes },
        command,
      );
      if (
        next.notes.some(
          (note) => note.pitch < preset.minNote || note.pitch > preset.maxNote,
        )
      )
        return;
      gesture.previewNotes = next.notes;
      setPreviewNotes(next.notes);
      if (gesture.mode === "move" || gesture.mode === "copy") {
        const primaryNote = next.notes.find(
          ({ noteId }) => noteId === gesture.auditionNoteId,
        );
        if (primaryNote && primaryNote.pitch !== gesture.lastAuditionPitch) {
          gesture.lastAuditionPitch = primaryNote.pitch;
          performance.previewNote(primaryNote.pitch, primaryNote.velocity);
        }
      }
    } catch {
      // Keep the last valid preview while the pointer is outside canonical bounds.
    }
  }

  function finishPointerGesture(event: React.PointerEvent<HTMLCanvasElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.previewNotes) {
      setHistory((current) =>
        replaceMidiEditorNotes(current, gesture.previewNotes ?? current.notes),
      );
      if (gesture.mode === "copy") setSelectedIds(new Set(gesture.copyIds));
      markEdited();
      setNotice(
        gesture.mode === "resize"
          ? "Note length changed. Autosave is listening."
          : gesture.mode === "copy"
            ? "Selection copied and moved as one edit. Autosave is listening."
            : "Selection moved. Autosave is listening.",
      );
    }
    setPreviewNotes(null);
    gestureRef.current = null;
    event.currentTarget.style.cursor = "crosshair";
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function finishMarqueeGesture(event: React.PointerEvent<HTMLCanvasElement>) {
    const gesture = marqueeGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (!gesture.moved && !gesture.additive) setSelectedIds(new Set());
    setNotice(
      gesture.moved
        ? "Phrase selected. Drag any selected note to move the block."
        : "Selection cleared.",
    );
    marqueeGestureRef.current = null;
    setMarquee(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function finishPianoGesture(event: React.PointerEvent<HTMLCanvasElement>) {
    const gesture = pianoGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    performance.previewOff(gesture.source);
    pianoGestureRef.current = null;
    event.currentTarget.style.cursor = "pointer";
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function performancePitchFromElement(element: Element | null) {
    const key = element?.closest<HTMLElement>("[data-performance-pitch]");
    if (!key || !performanceKeyboardRef.current?.contains(key)) return null;
    const pitch = Number(key.dataset.performancePitch);
    return Number.isInteger(pitch) ? pitch : null;
  }

  function startPerformanceKeyGesture(
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    if (event.button !== 0 || performanceKeyGestureRef.current) return;
    const pitch = performancePitchFromElement(event.target as Element);
    if (pitch === null) return;
    const source = `performance-key:${event.pointerId}`;
    performanceKeyGestureRef.current = {
      pointerId: event.pointerId,
      pitch,
      source,
    };
    performance.noteOn(
      pitch,
      performance.defaultVelocity,
      globalThis.performance.now(),
      source,
    );
  }

  function movePerformanceKeyGesture(
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    const gesture = performanceKeyGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      finishPerformanceKeyGesture(event);
      return;
    }
    const pitch = performancePitchFromElement(
      document.elementFromPoint(event.clientX, event.clientY) ??
        (event.target as Element),
    );
    if (pitch === null || pitch === gesture.pitch) return;
    gesture.pitch = pitch;
    performance.noteOn(
      pitch,
      performance.defaultVelocity,
      globalThis.performance.now(),
      gesture.source,
    );
  }

  function finishPerformanceKeyGesture(
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    const gesture = performanceKeyGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    performance.noteOff(
      gesture.pitch,
      globalThis.performance.now(),
      gesture.source,
    );
    performanceKeyGestureRef.current = null;
  }

  function enterPerformanceKey(pitch: number) {
    const gesture = performanceKeyGestureRef.current;
    if (!gesture || pitch === gesture.pitch) return;
    gesture.pitch = pitch;
    performance.noteOn(
      pitch,
      performance.defaultVelocity,
      globalThis.performance.now(),
      gesture.source,
    );
  }

  function finishPointerInteraction(
    event: React.PointerEvent<HTMLCanvasElement>,
  ) {
    finishPianoGesture(event);
    finishMarqueeGesture(event);
    finishPointerGesture(event);
  }

  function cancelPointerInteraction(
    event: React.PointerEvent<HTMLCanvasElement>,
  ) {
    finishPianoGesture(event);
    const marqueeGesture = marqueeGestureRef.current;
    if (marqueeGesture?.pointerId === event.pointerId) {
      setSelectedIds(new Set(marqueeGesture.initialSelection));
      marqueeGestureRef.current = null;
      setMarquee(null);
    }
    const gesture = gestureRef.current;
    if (gesture?.pointerId === event.pointerId) {
      gestureRef.current = null;
      setPreviewNotes(null);
    }
    event.currentTarget.style.cursor = "crosshair";
  }

  function handleContextMenu(event: React.MouseEvent<HTMLCanvasElement>) {
    const hit = noteAtPointer(event.clientX, event.clientY);
    if (!hit) return;
    event.preventDefault();
    commitCommand(
      { type: "deleteNotes", noteIds: [hit.note.noteId] },
      `${midiPitchName(hit.note.pitch)} removed.`,
      [],
    );
  }

  function handleDoubleClick(event: React.MouseEvent<HTMLCanvasElement>) {
    if (editorTool !== "pencil") return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX - rect.left < keyW) return;
    addNoteAt(event.clientX, event.clientY);
  }

  function addNoteAt(clientX?: number, clientY?: number) {
    if (history.notes.length >= MAX_MIDI_NOTES_PER_STEM) {
      setNotice("This stem has reached the 2,048-note limit.");
      return;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    const grid = QUANTIZATION_TICKS[quantization];
    const rawTick =
      rect && clientX !== undefined
        ? ((clientX - rect.left + viewport.scrollLeft - keyW) / pixelsPerBeat) *
          MIDI_PPQ
        : visiblePlayheadTick;
    const startTick = Math.max(0, Math.round(rawTick / grid) * grid);
    const rawRow =
      rect && clientY !== undefined
        ? Math.floor((clientY - rect.top + viewport.scrollTop) / rowH)
        : Math.floor(pitchCount / 2);
    const pitch = Math.max(
      preset.minNote,
      Math.min(preset.maxNote, preset.maxNote - rawRow),
    );
    const durationTicks = Math.min(
      MIDI_PPQ,
      Math.max(1, draft.durationTicks - startTick),
    );
    if (startTick >= draft.durationTicks) {
      setNotice("Scroll left to add a note inside the stem boundary.");
      return;
    }
    const note: MidiNoteV1 = {
      noteId: crypto.randomUUID(),
      pitch,
      velocity: 96,
      startTick,
      durationTicks,
    };
    commitCommand({ type: "addNote", note }, "Note added.", [note.noteId]);
    performance.previewNote(note.pitch, note.velocity);
  }

  function deleteSelection() {
    if (!selectedIds.size) return;
    commitCommand(
      { type: "deleteNotes", noteIds: [...selectedIds] },
      `${selectedIds.size} note${selectedIds.size === 1 ? "" : "s"} removed.`,
      [],
    );
  }

  function duplicateSelection() {
    if (!selectedNotes.length) return;
    if (history.notes.length + selectedNotes.length > MAX_MIDI_NOTES_PER_STEM) {
      setNotice("Duplicating that selection would exceed 2,048 notes.");
      return;
    }
    const offset = QUANTIZATION_TICKS[quantization];
    const copies = selectedNotes.map((note) => ({
      ...note,
      noteId: crypto.randomUUID(),
      startTick: note.startTick + offset,
    }));
    if (
      copies.some(
        (note) => note.startTick + note.durationTicks > draft.durationTicks,
      )
    ) {
      setNotice(
        "There is not enough room after this selection to duplicate it.",
      );
      return;
    }
    commitCommand(
      {
        type: "duplicateNotes",
        noteIds: selectedNotes.map(({ noteId }) => noteId),
        copies,
      },
      "Selection duplicated one grid step later.",
      copies.map(({ noteId }) => noteId),
    );
  }

  function copySelection() {
    if (!selectedNotes.length) return;
    noteClipboardRef.current = selectedNotes.map((note) => ({ ...note }));
    setNotice(
      `${selectedNotes.length} note${selectedNotes.length === 1 ? "" : "s"} copied.`,
    );
  }

  function pasteSelection() {
    const clipboard = noteClipboardRef.current;
    if (!clipboard.length) {
      setNotice("Select notes and copy them before pasting.");
      return;
    }
    if (history.notes.length + clipboard.length > MAX_MIDI_NOTES_PER_STEM) {
      setNotice("Pasting that block would exceed 2,048 notes.");
      return;
    }
    const offset = QUANTIZATION_TICKS[quantization];
    const copies = clipboard.map((note) => ({
      ...note,
      noteId: crypto.randomUUID(),
      startTick: note.startTick + offset,
    }));
    if (
      copies.some(
        (note) => note.startTick + note.durationTicks > draft.durationTicks,
      )
    ) {
      setNotice("There is not enough room after the copied block to paste it.");
      return;
    }
    commitCommand(
      {
        type: "duplicateNotes",
        noteIds: clipboard.map(({ noteId }) => noteId),
        copies,
      },
      "Copied notes pasted one grid step later.",
      copies.map(({ noteId }) => noteId),
    );
  }

  function undo() {
    const next = undoMidiEditor(history);
    if (next === history) return;
    setHistory(next);
    setSelectedIds(
      new Set(
        [...selectedIds].filter((id) =>
          next.notes.some((note) => note.noteId === id),
        ),
      ),
    );
    setNotice("Last note edit undone.");
    markEdited();
  }

  function redo() {
    const next = redoMidiEditor(history);
    if (next === history) return;
    setHistory(next);
    setNotice("Note edit restored.");
    markEdited();
  }

  function quantizeSelection() {
    if (!selectedIds.size) return;
    commitCommand(
      {
        type: "quantizeNotes",
        noteIds: [...selectedIds],
        division: quantization,
      },
      `Quantized to ${quantization}. Use Undo to compare the original timing.`,
    );
  }

  function moveSelection(deltaTicks: number, deltaPitch: number) {
    if (!selectedIds.size) return;
    commitCommand(
      {
        type: "moveNotes",
        noteIds: [...selectedIds],
        deltaTicks,
        deltaPitch,
      },
      "Selection moved from the keyboard.",
    );
  }

  function resizeSelection(deltaTicks: number) {
    if (!selectedIds.size) return;
    commitCommand(
      { type: "resizeNotes", noteIds: [...selectedIds], deltaTicks },
      "Selection resized from the keyboard.",
    );
  }

  function handleEditorKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (
      target.matches("input, textarea, select, [contenteditable='true']") ||
      saveStatusRef.current === "conflict"
    )
      return;
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    } else if (modifier && event.key.toLowerCase() === "y") {
      event.preventDefault();
      redo();
    } else if (modifier && event.key.toLowerCase() === "d") {
      event.preventDefault();
      duplicateSelection();
    } else if (modifier && event.key.toLowerCase() === "c") {
      event.preventDefault();
      copySelection();
    } else if (modifier && event.key.toLowerCase() === "v") {
      event.preventDefault();
      pasteSelection();
    } else if (modifier && event.key.toLowerCase() === "a") {
      event.preventDefault();
      setSelectedIds(new Set(history.notes.map(({ noteId }) => noteId)));
    } else if (event.key === "Escape") {
      event.preventDefault();
      setSelectedIds(new Set());
      setMarquee(null);
      marqueeGestureRef.current = null;
      setNotice("Selection cleared.");
    } else if (!modifier && !event.altKey && event.key.toLowerCase() === "p") {
      event.preventDefault();
      setEditorTool("pencil");
      setNotice("Pencil tool active. Double-click empty space to add a note.");
    } else if (!modifier && !event.altKey && event.key.toLowerCase() === "v") {
      event.preventDefault();
      setEditorTool("select");
      setNotice("Select tool active. Drag empty space around a phrase.");
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteSelection();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(0, 1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(0, -1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const delta =
        QUANTIZATION_TICKS[quantization] * (event.key === "ArrowLeft" ? -1 : 1);
      if (event.shiftKey) resizeSelection(delta);
      else moveSelection(delta, 0);
    } else if (!modifier && !event.altKey && performance.keyDown(event.key)) {
      event.preventDefault();
    }
  }

  function handleEditorKeyUp(event: React.KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (target.matches("input, textarea, select, [contenteditable='true']")) {
      return;
    }
    if (performance.keyUp(event.key)) event.preventDefault();
  }

  // Moving the playhead always stops transport first so audio never keeps
  // running against a position it is no longer scheduled from.
  function seekTo(tick: number) {
    stopPlayback();
    stopAudition();
    setPlayheadTick(
      Math.max(0, Math.min(draft.durationTicks, Math.round(tick))),
    );
  }

  function stopSeekHold() {
    const hold = seekHoldRef.current;
    if (hold.timeout) clearTimeout(hold.timeout);
    if (hold.frame !== null) cancelAnimationFrame(hold.frame);
    hold.timeout = null;
    hold.frame = null;
  }

  // A tap steps one bar (handled by the click); holding past the delay scrubs
  // continuously at a time-based rate so it stays smooth on any frame rate.
  function beginSeekHold(direction: -1 | 1) {
    stopSeekHold();
    stopPlayback();
    stopAudition();
    const hold = seekHoldRef.current;
    hold.repeated = false;
    hold.timeout = setTimeout(() => {
      hold.repeated = true;
      let previous = globalThis.performance.now();
      const advance = () => {
        const now = globalThis.performance.now();
        const seconds = (now - previous) / 1_000;
        previous = now;
        setPlayheadTick((current) =>
          Math.max(
            0,
            Math.min(
              draft.durationTicks,
              current +
                direction * seconds * MIDI_PPQ * SEEK_HOLD_BEATS_PER_SECOND,
            ),
          ),
        );
        hold.frame = requestAnimationFrame(advance);
      };
      hold.frame = requestAnimationFrame(advance);
    }, SEEK_HOLD_DELAY_MS);
  }

  // Suppress the trailing click that follows a hold, so releasing does not add
  // an extra bar jump on top of the scrub.
  function stepSeekBar(direction: -1 | 1) {
    const hold = seekHoldRef.current;
    if (hold.repeated) {
      hold.repeated = false;
      return;
    }
    seekTo(visiblePlayheadTick + direction * barTicks);
  }

  async function play() {
    if (!history.notes.length) {
      setNotice("Add a note before pressing play.");
      return;
    }
    stopAudition();
    performance.stopRecording();
    stopPlayback();
    // Start where the playhead sits so the transport controls are meaningful.
    const fromTick = Math.max(
      0,
      Math.min(draft.durationTicks, Math.round(playheadTick)),
    );
    setPlaying(true);
    setPlayheadTick(fromTick);
    try {
      const { createPresetVoice, resumeMidiAudioContext } =
        await import("../browser-engine/preset-voice.client");
      const contextTime = await resumeMidiAudioContext();
      const voice = await createPresetVoice(presetId, 1);
      voiceRef.current = voice;
      const leadIn = 0.05;
      host?.onPlaybackTransportStart(fromTick, 0);
      const secondsPerTick = 60 / ((host?.tempoBpm ?? 120) * MIDI_PPQ);
      for (const note of history.notes) {
        const startOffset = note.startTick - fromTick;
        // Notes already finished are skipped; one still sounding starts now for
        // whatever remains of it.
        const remainingTicks = note.durationTicks + Math.min(0, startOffset);
        if (remainingTicks <= 0) continue;
        voice.triggerAttackRelease(
          note.pitch,
          remainingTicks * secondsPerTick,
          contextTime + leadIn + Math.max(0, startOffset) * secondsPerTick,
          note.velocity / 127,
        );
      }
      const startedAt = globalThis.performance.now() + leadIn * 1_000;
      playheadTimerRef.current = setInterval(() => {
        setPlayheadTick(
          Math.min(
            draft.durationTicks,
            Math.max(
              0,
              fromTick +
                (globalThis.performance.now() - startedAt) /
                  1_000 /
                  secondsPerTick,
            ),
          ),
        );
      }, 50);
      const endTick = Math.max(
        ...history.notes.map((note) => note.startTick + note.durationTicks),
      );
      stopTimerRef.current = setTimeout(
        stopPlayback,
        (leadIn + Math.max(0, endTick - fromTick) * secondsPerTick + 1.5) *
          1_000,
      );
    } catch {
      stopPlayback();
      setNotice(
        "Playback couldn’t start. Check browser audio permission and retry.",
      );
    }
  }

  async function publishVersion() {
    if (saveState.status !== "saved") {
      setPublicationState({
        status: "error",
        message: "Save the private draft before freezing a version.",
      });
      return;
    }
    setPublicationState({
      status: "publishing",
      message: "Freezing an immutable version…",
    });
    if (!host) {
      setPublicationState({
        status: "error",
        message: "Open this pattern in Studio before freezing a version.",
      });
      return;
    }
    const result = await host.finalize({
      draftId: draft.draftId,
      expectedLockVersion: lockVersionRef.current,
      expectedContentSha256: contentSha256Ref.current,
      content: {
        name,
        presetId,
        presetVersion: 1,
        ppq: MIDI_PPQ,
        durationTicks: draft.durationTicks,
        notes: [...history.notes],
      },
    });
    setPublicationState({
      status: result.ok ? "published" : "error",
      message: result.message,
    });
  }

  function updateSelectedNote(
    field: keyof Omit<MidiNoteV1, "noteId">,
    value: number,
  ) {
    if (!selectedNote || !Number.isInteger(value)) return;
    if (field === "velocity") {
      commitCommand(
        {
          type: "setVelocity",
          noteIds: [selectedNote.noteId],
          velocity: value,
        },
        "Velocity updated from the note inspector.",
      );
    } else if (field === "durationTicks") {
      resizeSelection(value - selectedNote.durationTicks);
    } else {
      commitCommand(
        {
          type: "moveNotes",
          noteIds: [selectedNote.noteId],
          deltaTicks:
            field === "startTick" ? value - selectedNote.startTick : 0,
          deltaPitch: field === "pitch" ? value - selectedNote.pitch : 0,
        },
        "Note updated from the inspector.",
      );
      if (
        field === "pitch" &&
        value >= preset.minNote &&
        value <= preset.maxNote
      ) {
        performance.previewNote(value, selectedNote.velocity);
      }
    }
  }

  return (
    <section
      className={host ? "flex min-h-0 flex-1 flex-col" : "mt-8"}
      onKeyDown={handleEditorKeyDown}
      onKeyUp={handleEditorKeyUp}
    >
      <div
        className={
          host
            ? "relative flex min-h-0 flex-1 flex-col"
            : "rounded-card border-subtle bg-surface shadow-raised relative border p-4 sm:p-6"
        }
      >
        {recovery && (
          <div className="border-accent-2 bg-surface-soft rounded-control mb-5 border p-4">
            <p className="font-semibold">
              Unsaved notes were found on this device.
            </p>
            <p className="text-muted mt-1 text-sm">
              Restore the private local copy from{" "}
              {new Date(recovery.savedAt).toLocaleString()}, or keep the server
              draft.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={secondaryButton}
                onClick={() => {
                  setName(recovery.content.name);
                  setPresetId(recovery.content.defaultPresetId);
                  setHistory(createMidiEditorHistory(recovery.content.notes));
                  setSelectedIds(new Set());
                  setRecovery(null);
                  markEdited();
                }}
              >
                Restore local notes
              </button>
              <button
                type="button"
                className={secondaryButton}
                onClick={() => {
                  clearMidiDraftRecovery(draft.ownerId, draft.draftId);
                  setRecovery(null);
                }}
              >
                Keep server draft
              </button>
            </div>
          </div>
        )}
        <div className="order-1 flex flex-wrap items-center gap-x-3 gap-y-2">
          {host && (
            <p className="text-accent shrink-0 font-mono text-[10px] tracking-widest uppercase max-lg:hidden">
              MIDI editor
            </p>
          )}
          <label className="min-w-0 flex-1 sm:max-w-56">
            <span className="sr-only">Stem name</span>
            <input
              className={fieldClass}
              placeholder="Stem name"
              value={name}
              maxLength={120}
              onChange={(event) => {
                setName(event.target.value);
                markEdited();
              }}
            />
          </label>
          <label className="shrink-0">
            <span className="sr-only">Sound</span>
            <span className="relative block">
              <FiMusic
                aria-hidden
                className="text-accent pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base"
              />
              <select
                className={`${selectFieldClass} sm:w-56`}
                title={preset.description}
                value={presetId}
                onChange={(event) => {
                  const nextPreset = resolveSynthPreset(
                    event.target.value,
                    1,
                    host ? MIDI_V3_ENGINE_VERSION : undefined,
                  );
                  if (
                    history.notes.some(
                      (note) =>
                        note.pitch < nextPreset.minNote ||
                        note.pitch > nextPreset.maxNote,
                    )
                  ) {
                    setNotice(
                      `${nextPreset.name} cannot play every current note. Move or delete out-of-range notes first.`,
                    );
                    return;
                  }
                  stopPlayback();
                  stopAudition();
                  performance.stopRecording();
                  setPresetId(nextPreset.presetId);
                  setHistory(createMidiEditorHistory(history.notes));
                  markEdited();
                }}
              >
                {(host ? INSTRUMENT_PRESETS_CATALOG_1 : SYNTH_PRESETS_V1).map(
                  (item) => (
                    <option key={item.presetId} value={item.presetId}>
                      {item.name}
                    </option>
                  ),
                )}
              </select>
            </span>
          </label>
          {host && (
            <span className="text-muted shrink-0 font-mono text-xs max-lg:hidden">
              {host.tempoBpm} BPM · {host.timeSignature.numerator}/
              {host.timeSignature.denominator}
            </span>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void publishVersion()}
              disabled={
                publicationState.status === "publishing" ||
                saveState.status !== "saved" ||
                !name.trim()
              }
              className={secondaryButton}
            >
              <FiDisc aria-hidden />
              {publicationState.status === "publishing"
                ? "Saving…"
                : (host?.finalizeLabel ?? "Save to My stems")}
            </button>
            {host && (
              <button
                type="button"
                className="border-strong hover:border-accent hover:text-accent min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors"
                onClick={host.onClose}
              >
                Close MIDI editor
              </button>
            )}
          </div>
        </div>
        {preset.drumMap && (
          <details className="order-1 mt-1">
            <summary className="text-muted hover:text-accent mx-auto w-fit cursor-pointer list-none text-center font-mono text-[10px] tracking-widest uppercase transition-colors">
              Kit map
            </summary>
            <p className="text-muted mt-1 text-center text-xs">
              {Object.entries(preset.drumMap)
                .map(([pitch, label]) => `${pitch} ${label}`)
                .join(" · ")}
            </p>
          </details>
        )}

        {/* The recorder floats over the roll as a dismissible glass panel so
            expanding it never squeezes or overlaps the grid. */}
        <section
          className={`border-strong bg-surface-raised/95 rounded-card absolute inset-x-6 bottom-6 z-40 mx-auto w-fit max-w-full border p-4 shadow-2xl backdrop-blur-xl ${performOpen ? "" : "hidden"}`}
          aria-labelledby="performance-heading"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              aria-expanded={performOpen}
              title="Close the recorder"
              onClick={() => setPerformOpen(false)}
              className="hover:text-accent -m-1 flex items-center gap-2 rounded p-1 transition-colors"
            >
              <FiChevronDown
                aria-hidden
                className={`text-muted transition-transform ${performOpen ? "" : "-rotate-90"} motion-reduce:transition-none`}
              />
              <h2 id="performance-heading" className="text-base font-semibold">
                Perform a take
              </h2>
            </button>
            <p
              role="status"
              aria-live="assertive"
              className={
                performance.status === "idle"
                  ? "text-muted text-sm"
                  : "text-danger font-mono text-sm font-semibold uppercase"
              }
            >
              {performance.status === "count-in"
                ? "Count-in · recording next bar"
                : performance.status === "recording"
                  ? `Recording · tick ${Math.round(performance.playheadTick)}`
                  : "Recorder ready"}
            </p>
          </div>

          {/* Stays mounted (so the card keeps a stable width) and is made inert
              while collapsed so its controls leave the tab order. */}
          <motion.div
            className="overflow-hidden"
            initial={false}
            animate={{
              height: performOpen ? "auto" : 0,
              opacity: performOpen ? 1 : 0,
            }}
            transition={{
              duration: reduce ? 0 : 0.28,
              ease: [0.2, 0.8, 0.2, 1],
            }}
            inert={!performOpen}
          >
            <p className="text-muted mt-1 text-sm">
              Use the piano, A–K QWERTY keys, or optional hardware MIDI. Raw
              timing stays untouched until you choose Quantize.
            </p>

            <div className="mt-4 flex flex-wrap items-end justify-center gap-3">
              <label className="text-sm font-semibold">
                QWERTY octave
                <select
                  className="border-strong bg-surface rounded-control ml-2 min-h-11 border px-3"
                  value={performance.octave}
                  onChange={(event) =>
                    performance.setOctave(Number(event.target.value))
                  }
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((octave) => (
                    <option key={octave} value={octave}>
                      C{octave}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Default velocity
                <input
                  type="number"
                  min={1}
                  max={127}
                  className="border-strong bg-surface rounded-control ml-2 min-h-11 w-20 border px-3"
                  value={performance.defaultVelocity}
                  onChange={(event) =>
                    performance.setDefaultVelocity(
                      Math.max(
                        1,
                        Math.min(127, event.target.valueAsNumber || 1),
                      ),
                    )
                  }
                />
              </label>
              <label className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={performance.countIn}
                  onChange={(event) =>
                    performance.setCountIn(event.target.checked)
                  }
                  disabled={performance.status !== "idle"}
                />
                One-bar count-in
              </label>
              <label className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={performance.metronome}
                  onChange={(event) =>
                    performance.setMetronome(event.target.checked)
                  }
                  disabled={performance.status !== "idle"}
                />
                Metronome
              </label>
            </div>

            <div
              ref={performanceKeyboardRef}
              className="mt-4 flex max-w-full justify-center gap-1 overflow-x-auto pb-2"
              aria-label="On-screen piano"
              onPointerDown={startPerformanceKeyGesture}
              onPointerMove={movePerformanceKeyGesture}
              onPointerUp={finishPerformanceKeyGesture}
              onPointerCancel={finishPerformanceKeyGesture}
              onPointerLeave={finishPerformanceKeyGesture}
            >
              {performancePitches.map((pitch) => {
                const active = performance.activePitches.has(pitch);
                return (
                  <button
                    key={pitch}
                    type="button"
                    className={`focus-visible:ring-accent min-h-20 min-w-12 rounded-b-md border px-2 text-xs font-semibold transition-[background-color,color,box-shadow,transform] duration-100 focus-visible:ring-2 motion-reduce:transform-none motion-reduce:transition-none ${
                      active
                        ? "border-accent-2 bg-accent-2 text-accent-contrast -translate-y-0.5 shadow-[0_0_16px_var(--color-accent-2)]"
                        : isBlackPianoKey(pitch)
                          ? "border-strong bg-canvas text-ink"
                          : "border-subtle bg-ink text-canvas"
                    }`}
                    aria-label={`Play ${midiPitchName(pitch)}${
                      preset.drumMap?.[String(pitch)]
                        ? ` — ${preset.drumMap[String(pitch)]}`
                        : ""
                    }, MIDI note ${pitch}`}
                    aria-pressed={active}
                    title={preset.drumMap?.[String(pitch)]}
                    onPointerEnter={() => enterPerformanceKey(pitch)}
                    data-performance-pitch={pitch}
                  >
                    <span className="block">{midiPitchName(pitch)}</span>
                    {preset.drumMap?.[String(pitch)] && (
                      <span className="mt-0.5 block max-w-16 truncate text-[9px] font-normal opacity-75">
                        {preset.drumMap[String(pitch)]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="sr-only" aria-live="polite">
              {performance.activePitches.size
                ? `Playing ${[...performance.activePitches]
                    .sort((left, right) => left - right)
                    .map(midiPitchName)
                    .join(", ")}`
                : "No piano notes held"}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {performance.status === "idle" ? (
                <button
                  type="button"
                  className="cta-gradient text-accent-contrast inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-60"
                  disabled={
                    playing ||
                    history.notes.length >= MAX_MIDI_NOTES_PER_STEM ||
                    saveState.status === "conflict"
                  }
                  onClick={() => {
                    stopPlayback();
                    stopAudition();
                    void performance.startRecording();
                  }}
                >
                  <FiDisc aria-hidden /> Record
                </button>
              ) : (
                <button
                  type="button"
                  className="border-danger text-danger inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-sm font-semibold"
                  onClick={() =>
                    performance.stopRecording(
                      "Take stopped. Open notes were closed safely.",
                    )
                  }
                >
                  <FiSquare aria-hidden /> Stop recording
                </button>
              )}
              {performance.webMidiStatus === "unavailable" ? (
                <span className="text-muted text-sm">
                  Hardware MIDI unavailable here · piano and QWERTY remain ready
                </span>
              ) : performance.webMidiStatus === "connected" ? (
                <span className="text-muted inline-flex items-center gap-2 text-sm">
                  <FiRadio aria-hidden /> {performance.hardwareInputCount}{" "}
                  hardware input
                  {performance.hardwareInputCount === 1 ? "" : "s"} connected
                </span>
              ) : (
                <button
                  type="button"
                  className={secondaryButton}
                  disabled={performance.webMidiStatus === "requesting"}
                  onClick={() => void performance.requestWebMidi()}
                >
                  <FiRadio aria-hidden />
                  {performance.webMidiStatus === "requesting"
                    ? "Requesting MIDI…"
                    : performance.webMidiStatus === "denied"
                      ? "Retry hardware MIDI"
                      : "Connect hardware MIDI"}
                </button>
              )}
            </div>
            {performance.webMidiStatus === "denied" && (
              <p className="text-muted mt-2 text-sm">
                Permission was denied or no usable input was available. Nothing
                about the device was saved; continue with the piano or QWERTY.
              </p>
            )}
          </motion.div>
        </section>

        {publicationState.message && (
          <p
            role="status"
            className={`order-2 mt-2 text-center text-sm ${
              publicationState.status === "error"
                ? "text-danger"
                : publicationState.status === "published"
                  ? "text-accent-2"
                  : "text-muted"
            }`}
          >
            {publicationState.message}
          </p>
        )}

        <div
          className={`border-strong rounded-card order-3 mt-2 flex min-h-0 flex-col overflow-hidden border bg-[radial-gradient(120%_90%_at_85%_-10%,rgba(255,141,99,0.09),transparent_55%),radial-gradient(90%_80%_at_10%_110%,rgba(255,200,121,0.06),transparent_55%)] ${host ? "flex-1" : "h-[38rem]"}`}
        >
          <div className="border-subtle bg-surface/35 grid items-center gap-3 border-b px-3 py-2 backdrop-blur-md lg:grid-cols-[1fr_auto_1fr]">
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="border-strong inline-flex rounded-full border p-1"
                role="group"
                aria-label="Piano-roll tool"
              >
                <button
                  type="button"
                  className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold ${editorTool === "pencil" ? "bg-accent text-canvas" : "text-muted hover:text-ink"}`}
                  aria-pressed={editorTool === "pencil"}
                  aria-keyshortcuts="P"
                  onClick={() => {
                    setEditorTool("pencil");
                    setNotice(
                      "Pencil tool active. Double-click empty space to add a note.",
                    );
                  }}
                >
                  <FiEdit3 aria-hidden /> Pencil
                </button>
                <button
                  type="button"
                  className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold ${editorTool === "select" ? "bg-accent text-canvas" : "text-muted hover:text-ink"}`}
                  aria-pressed={editorTool === "select"}
                  aria-keyshortcuts="V"
                  onClick={() => {
                    setEditorTool("select");
                    setNotice(
                      "Select tool active. Drag empty space around a phrase.",
                    );
                  }}
                >
                  <FiMousePointer aria-hidden /> Select
                </button>
              </div>
              <span aria-hidden className="mx-0.5 h-6 w-px bg-white/10" />
              <button
                type="button"
                className={transportButton}
                onClick={undo}
                disabled={!history.past.length}
                aria-label="Undo"
                title="Undo (Ctrl+Z)"
              >
                <FiCornerUpLeft aria-hidden />
              </button>
              <button
                type="button"
                className={transportButton}
                onClick={redo}
                disabled={!history.future.length}
                aria-label="Redo"
                title="Redo (Ctrl+Shift+Z)"
              >
                <FiCornerUpRight aria-hidden />
              </button>
              <button
                type="button"
                className={transportButton}
                onClick={deleteSelection}
                disabled={!selectedIds.size}
                aria-label="Delete selection"
                title="Delete selection (Del)"
              >
                <FiTrash2 aria-hidden />
              </button>
              <span aria-hidden className="mx-0.5 h-6 w-px bg-white/10" />
              <label className="text-muted inline-flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase">
                Grid
                <select
                  className="border-strong bg-surface text-ink ml-1 min-h-9 rounded-full border px-2.5 text-xs font-semibold"
                  value={quantization}
                  onChange={(event) =>
                    setQuantization(event.target.value as Quantization)
                  }
                >
                  {Object.keys(QUANTIZATION_TICKS).map((division) => (
                    <option key={division}>{division}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={transportButton}
                onClick={quantizeSelection}
                disabled={!selectedIds.size}
                aria-label="Quantize selection to grid"
                title="Quantize selection to grid"
              >
                <FiZap aria-hidden />
              </button>
              <button
                type="button"
                className={`${transportButton} ${performOpen ? "border-accent text-accent" : ""}`}
                aria-expanded={performOpen}
                onClick={() => setPerformOpen((open) => !open)}
                aria-label="Perform a take"
                title="Perform a take"
              >
                <FiDisc
                  aria-hidden
                  className={
                    performance.status === "idle" ? undefined : "text-danger"
                  }
                />
              </button>
              <button
                type="button"
                className={transportButton}
                onClick={() => setShowShortcuts((value) => !value)}
                aria-label="Keyboard shortcuts"
                title="Keyboard shortcuts"
              >
                <FiHelpCircle aria-hidden />
              </button>
            </div>

            <div
              className="flex items-center gap-1.5 justify-self-center"
              aria-label="Transport"
            >
              <button
                type="button"
                className={transportButton}
                aria-label="Move playhead to start"
                title="Move playhead to start"
                disabled={visiblePlayheadTick <= 0}
                onClick={() => seekTo(0)}
              >
                <FiSkipBack />
              </button>
              <button
                type="button"
                className={transportButton}
                aria-label="Move playhead back one bar. Hold to rewind."
                title="Back one bar · hold to rewind"
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  beginSeekHold(-1);
                }}
                onPointerUp={stopSeekHold}
                onPointerCancel={stopSeekHold}
                onLostPointerCapture={stopSeekHold}
                onClick={() => stepSeekBar(-1)}
              >
                <FiRewind />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (playing) {
                    stopPlayback();
                    stopAudition();
                    performance.releaseActive();
                  } else void play();
                }}
                className="cta-gradient text-accent-contrast inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold"
              >
                {playing ? <FiSquare aria-hidden /> : <FiPlay aria-hidden />}
                {playing ? "Stop" : "Play stem"}
              </button>
              <button
                type="button"
                className={transportButton}
                aria-label="Move playhead forward one bar. Hold to fast-forward."
                title="Forward one bar · hold to fast-forward"
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  beginSeekHold(1);
                }}
                onPointerUp={stopSeekHold}
                onPointerCancel={stopSeekHold}
                onLostPointerCapture={stopSeekHold}
                onClick={() => stepSeekBar(1)}
              >
                <FiFastForward />
              </button>
              <div className="studio-lcd ml-1" aria-live="off">
                <div className="studio-lcd-seg">
                  <span className="studio-lcd-val">
                    {formatStemPosition(visiblePlayheadTick, beatsPerBar)}
                  </span>
                  <span className="studio-lcd-lbl" aria-hidden>
                    Position
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 justify-self-end">
              <span
                role="status"
                className={`text-xs ${
                  saveState.status === "error" ||
                  saveState.status === "conflict"
                    ? "text-danger"
                    : "text-muted"
                }`}
              >
                {saveState.message}
              </span>
              {(saveState.status === "offline" ||
                saveState.status === "error") && (
                <button
                  type="button"
                  className="text-accent text-xs font-semibold underline"
                  onClick={() => void performSave()}
                >
                  Retry
                </button>
              )}
              {saveState.status === "conflict" && (
                <button
                  type="button"
                  className="text-accent text-xs font-semibold underline"
                  onClick={() => window.location.reload()}
                >
                  Reload draft
                </button>
              )}
            </div>
          </div>

          {showShortcuts && (
            <div className="border-subtle bg-surface-soft/70 border-b p-4 text-sm backdrop-blur-md">
              <p className="font-semibold">Piano-roll keyboard controls</p>
              <p className="text-muted mt-1">
                Arrows move selected notes; Shift + Left/Right resizes; Delete
                removes; P chooses Pencil; V chooses Select; Escape clears;
                Ctrl/Cmd + C/V copies and pastes; Ctrl/Cmd + D duplicates;
                Ctrl/Cmd + Z undoes; Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
                redoes; Ctrl/Cmd + A selects all. Select-tool drags make a
                marquee, Shift toggles intersecting notes, Ctrl/Cmd-drag copies,
                and Alt-drag bypasses the grid. Text fields keep their normal
                shortcuts.
              </p>
            </div>
          )}

          <div className="flex min-h-0 flex-1 overflow-hidden max-xl:flex-col">
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 px-3 pt-1.5">
                <p className="text-muted font-mono text-[10px] tracking-widest uppercase">
                  Piano roll
                  <span className="ml-3 tracking-normal normal-case">
                    {history.notes.length.toLocaleString()} of 2,048 notes ·{" "}
                    {selectedIds.size} selected
                  </span>
                </p>
                <p
                  className="text-muted inline-flex items-center gap-2 text-xs"
                  aria-live="polite"
                >
                  <FiMousePointer aria-hidden />
                  {notice ||
                    (editorTool === "select"
                      ? "Drag empty space to select a phrase; drag the selection to move it."
                      : "Double-click empty space to add; drag notes or their gripped edge.")}
                </p>
              </div>

              <div
                ref={rollRef}
                className="bg-canvas min-h-0 flex-1 overflow-auto"
                onScroll={(event) => {
                  const { scrollLeft, scrollTop } = event.currentTarget;
                  setViewport((current) => ({
                    ...current,
                    scrollLeft,
                    scrollTop,
                  }));
                }}
              >
                <div
                  className="relative"
                  style={{ width: rollWidth, height: rollHeight }}
                >
                  <canvas
                    ref={canvasRef}
                    className="sticky top-0 left-0 block touch-none"
                    style={{ width: viewport.width, height: viewport.height }}
                    role="application"
                    tabIndex={0}
                    aria-label={`Piano roll with ${history.notes.length} notes. Use the note inspector after the roll for complete keyboard editing.`}
                    data-tool={editorTool}
                    data-testid="midi-piano-roll"
                    data-middle-c-row={preset.maxNote - 60}
                    onDoubleClick={handleDoubleClick}
                    onContextMenu={handleContextMenu}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={finishPointerInteraction}
                    onPointerCancel={cancelPointerInteraction}
                    onLostPointerCapture={cancelPointerInteraction}
                    onPointerLeave={(event) => {
                      finishPianoGesture(event);
                      if (!gestureRef.current)
                        event.currentTarget.style.cursor = "crosshair";
                    }}
                  />
                </div>
              </div>

              <div
                className="border-subtle relative h-24 shrink-0 overflow-hidden border-t bg-[linear-gradient(to_bottom,rgba(42,27,55,0.45),rgba(30,20,38,0.3))] backdrop-blur-md"
                role="group"
                aria-label="Velocity lane. Drag a stem or focus it and press the arrow keys to change that note's velocity."
              >
                <span className="text-muted absolute top-1.5 left-2 z-10 font-mono text-[9px] tracking-widest uppercase">
                  Velocity
                </span>
                <span
                  aria-hidden
                  className="bg-strong absolute inset-y-0 w-0.5"
                  style={{ left: keyW - 1 }}
                />
                {history.notes.map((note) => {
                  const x =
                    keyW +
                    (note.startTick / MIDI_PPQ) * pixelsPerBeat -
                    viewport.scrollLeft;
                  if (x < keyW - 2 || x > viewport.width + 24) return null;
                  const shownVelocity =
                    velocityDrag?.noteId === note.noteId
                      ? velocityDrag.velocity
                      : note.velocity;
                  const stemSelected = selectedIds.has(note.noteId);
                  return (
                    <button
                      key={note.noteId}
                      type="button"
                      role="slider"
                      aria-label={`Velocity of ${midiPitchName(note.pitch)} at tick ${note.startTick}`}
                      aria-valuemin={1}
                      aria-valuemax={127}
                      aria-valuenow={shownVelocity}
                      aria-orientation="vertical"
                      className="focus-visible:ring-accent absolute bottom-0 w-3 -translate-x-1/2 cursor-ns-resize touch-none focus-visible:ring-2"
                      style={{
                        left: x,
                        height: `${10 + (shownVelocity / 127) * 78}%`,
                      }}
                      onPointerDown={(event) => {
                        if (event.button !== 0) return;
                        event.currentTarget.setPointerCapture(event.pointerId);
                        setSelectedIds(new Set([note.noteId]));
                        setVelocityDrag({
                          noteId: note.noteId,
                          velocity: note.velocity,
                        });
                      }}
                      onPointerMove={(event) => {
                        if (velocityDrag?.noteId !== note.noteId) return;
                        const lane = event.currentTarget.parentElement;
                        if (!lane) return;
                        const rect = lane.getBoundingClientRect();
                        const ratio =
                          1 -
                          (event.clientY - rect.top) / Math.max(1, rect.height);
                        setVelocityDrag({
                          noteId: note.noteId,
                          velocity: Math.max(
                            1,
                            Math.min(127, Math.round(ratio * 127)),
                          ),
                        });
                      }}
                      onPointerUp={() => {
                        if (velocityDrag?.noteId !== note.noteId) return;
                        if (velocityDrag.velocity !== note.velocity)
                          commitCommand(
                            {
                              type: "setVelocity",
                              noteIds: [note.noteId],
                              velocity: velocityDrag.velocity,
                            },
                            "Velocity updated from the velocity lane.",
                          );
                        setVelocityDrag(null);
                      }}
                      onPointerCancel={() => setVelocityDrag(null)}
                      onLostPointerCapture={() => setVelocityDrag(null)}
                      onKeyDown={(event) => {
                        if (
                          event.key !== "ArrowUp" &&
                          event.key !== "ArrowDown"
                        )
                          return;
                        event.preventDefault();
                        event.stopPropagation();
                        const next = Math.max(
                          1,
                          Math.min(
                            127,
                            note.velocity + (event.key === "ArrowUp" ? 8 : -8),
                          ),
                        );
                        if (next !== note.velocity)
                          commitCommand(
                            {
                              type: "setVelocity",
                              noteIds: [note.noteId],
                              velocity: next,
                            },
                            "Velocity updated from the velocity lane.",
                          );
                      }}
                    >
                      <span
                        aria-hidden
                        className={`absolute inset-x-1 top-0 bottom-0 rounded-t-full ${stemSelected ? "bg-accent-2" : "bg-accent"}`}
                        style={{ opacity: 0.5 + (shownVelocity / 127) * 0.5 }}
                      />
                      <span
                        aria-hidden
                        className={`absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full ${stemSelected ? "bg-accent-2" : "bg-accent"}`}
                      />
                    </button>
                  );
                })}
              </div>

              <div className="border-subtle bg-surface-raised/80 absolute right-3 bottom-28 z-30 flex items-center gap-1 rounded-full border px-1.5 py-1 shadow-xl backdrop-blur-md">
                <button
                  type="button"
                  className="border-strong text-muted hover:border-accent hover:text-accent grid h-8 w-8 place-items-center rounded-full border transition-colors disabled:opacity-40"
                  aria-label="Zoom out timeline"
                  title="Zoom out timeline"
                  disabled={pixelsPerBeat <= MIN_PIXELS_PER_BEAT}
                  onClick={() =>
                    setPixelsPerBeat((value) =>
                      Math.max(MIN_PIXELS_PER_BEAT, value - 16),
                    )
                  }
                >
                  <FiZoomOut aria-hidden />
                </button>
                <button
                  type="button"
                  className="border-strong text-muted hover:border-accent hover:text-accent grid h-8 w-8 place-items-center rounded-full border transition-colors disabled:opacity-40"
                  aria-label="Zoom in timeline"
                  title="Zoom in timeline"
                  disabled={pixelsPerBeat >= MAX_PIXELS_PER_BEAT}
                  onClick={() =>
                    setPixelsPerBeat((value) =>
                      Math.min(MAX_PIXELS_PER_BEAT, value + 16),
                    )
                  }
                >
                  <FiZoomIn aria-hidden />
                </button>
              </div>
            </div>

            <aside
              className="border-subtle min-h-0 overflow-y-auto border-t bg-[linear-gradient(160deg,rgba(48,31,58,0.32),rgba(24,15,32,0.22))] backdrop-blur-md xl:w-88 xl:shrink-0 xl:border-t-0 xl:border-l"
              aria-label="Note list and inspector"
            >
              <div className="flex flex-col gap-6 p-5">
                <section aria-labelledby="note-inspector-heading">
                  <h2
                    id="note-inspector-heading"
                    className="text-accent mb-1 font-mono text-[10px] tracking-widest uppercase"
                  >
                    Note
                  </h2>
                  {!selectedNote ? (
                    <div>
                      <p className="text-xl font-semibold">
                        {selectedIds.size > 1
                          ? `${selectedIds.size} notes`
                          : "No selection"}
                      </p>
                      <p className="text-muted mt-1 text-xs leading-5">
                        {selectedIds.size > 1
                          ? "Use velocity, quantize, duplicate, move, or delete on the selection. Choose one note for exact fields."
                          : "Click a note on the roll to inspect and edit its exact values."}
                      </p>
                      {selectedIds.size > 1 && (
                        <label className="mt-3 block text-left text-sm font-semibold">
                          Velocity for selection
                          <input
                            className={inputClass}
                            type="number"
                            min={1}
                            max={127}
                            defaultValue={96}
                            onBlur={(event) =>
                              commitCommand(
                                {
                                  type: "setVelocity",
                                  noteIds: [...selectedIds],
                                  velocity: event.currentTarget.valueAsNumber,
                                },
                                "Selection velocity updated from the inspector.",
                              )
                            }
                          />
                        </label>
                      )}
                    </div>
                  ) : (
                    <>
                      <p className="text-2xl font-semibold">
                        {midiPitchName(selectedNote.pitch)}
                      </p>
                      <p className="text-muted font-mono text-[10px] tracking-widest uppercase">
                        Selected note
                      </p>
                      <dl className="mt-3">
                        <StepperRow
                          label="Pitch"
                          value={midiPitchName(selectedNote.pitch)}
                          decrementLabel="Transpose down one semitone"
                          incrementLabel="Transpose up one semitone"
                          canDecrement={selectedNote.pitch > preset.minNote}
                          canIncrement={selectedNote.pitch < preset.maxNote}
                          onDecrement={() =>
                            updateSelectedNote("pitch", selectedNote.pitch - 1)
                          }
                          onIncrement={() =>
                            updateSelectedNote("pitch", selectedNote.pitch + 1)
                          }
                        />
                        <StepperRow
                          label="Start"
                          value={formatTickPosition(
                            selectedNote.startTick,
                            beatsPerBar,
                          )}
                          decrementLabel="Move earlier by one grid step"
                          incrementLabel="Move later by one grid step"
                          canDecrement={selectedNote.startTick > 0}
                          canIncrement={
                            selectedNote.startTick +
                              selectedNote.durationTicks <
                            draft.durationTicks
                          }
                          onDecrement={() =>
                            updateSelectedNote(
                              "startTick",
                              Math.max(
                                0,
                                selectedNote.startTick -
                                  QUANTIZATION_TICKS[quantization],
                              ),
                            )
                          }
                          onIncrement={() =>
                            updateSelectedNote(
                              "startTick",
                              selectedNote.startTick +
                                QUANTIZATION_TICKS[quantization],
                            )
                          }
                        />
                        <StepperRow
                          label="Length"
                          value={formatTickLength(selectedNote.durationTicks)}
                          decrementLabel="Shorten by one grid step"
                          incrementLabel="Lengthen by one grid step"
                          canDecrement={
                            selectedNote.durationTicks >
                            QUANTIZATION_TICKS[quantization]
                          }
                          onDecrement={() =>
                            updateSelectedNote(
                              "durationTicks",
                              Math.max(
                                QUANTIZATION_TICKS[quantization],
                                selectedNote.durationTicks -
                                  QUANTIZATION_TICKS[quantization],
                              ),
                            )
                          }
                          onIncrement={() =>
                            updateSelectedNote(
                              "durationTicks",
                              selectedNote.durationTicks +
                                QUANTIZATION_TICKS[quantization],
                            )
                          }
                        />
                        <StepperRow
                          label="Velocity"
                          value={String(selectedNote.velocity)}
                          decrementLabel="Decrease velocity"
                          incrementLabel="Increase velocity"
                          canDecrement={selectedNote.velocity > 1}
                          canIncrement={selectedNote.velocity < 127}
                          onDecrement={() =>
                            updateSelectedNote(
                              "velocity",
                              Math.max(1, selectedNote.velocity - 8),
                            )
                          }
                          onIncrement={() =>
                            updateSelectedNote(
                              "velocity",
                              Math.min(127, selectedNote.velocity + 8),
                            )
                          }
                        />
                      </dl>
                    </>
                  )}
                </section>

                <section aria-label="Clip details">
                  <h2 className="text-accent mb-1 font-mono text-[10px] tracking-widest uppercase">
                    Clip
                  </h2>
                  <dl>
                    <KvRow label="Clip" value={name || "Untitled stem"} />
                    <KvRow
                      label="Length"
                      value={`${Number(
                        (draft.durationTicks / barTicks).toFixed(2),
                      )} bars`}
                    />
                    <KvRow label="Notes" value={String(history.notes.length)} />
                    <KvRow
                      label="Tempo"
                      value={`${host?.tempoBpm ?? 120} BPM`}
                    />
                    <KvRow label="Preset" value={preset.name} />
                  </dl>
                </section>

                <details className="group">
                  <summary className="text-accent hover:text-accent-2 flex cursor-pointer list-none items-center gap-2 font-mono text-[10px] tracking-widest uppercase transition-colors">
                    <FiChevronDown
                      aria-hidden
                      className="transition-transform group-open:rotate-180"
                    />
                    Note list
                  </summary>
                  <select
                    multiple
                    size={7}
                    className="border-strong bg-surface-soft rounded-control mt-2 w-full min-w-0 border p-2 font-mono text-xs"
                    aria-label="Notes in stem"
                    value={[...selectedIds]}
                    onChange={(event) => setSelectedIds(selectedValues(event))}
                  >
                    {history.notes.map((note, index) => (
                      <option key={note.noteId} value={note.noteId}>
                        {index + 1}. {midiPitchName(note.pitch)} · tick{" "}
                        {note.startTick} · {note.durationTicks} long · velocity{" "}
                        {note.velocity}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={`${secondaryButton} mt-2 w-full`}
                    onClick={() =>
                      setSelectedIds(
                        new Set(history.notes.map(({ noteId }) => noteId)),
                      )
                    }
                    disabled={!history.notes.length}
                  >
                    Select all notes
                  </button>
                </details>

                <p className="text-muted font-mono text-[10px] leading-relaxed">
                  <span className="text-ink">Pencil</span> click to draw ·{" "}
                  <span className="text-ink">Select</span> drag to move, edge to
                  resize · <span className="text-ink">Erase</span> click to
                  remove · <span className="text-ink">←→↑↓</span> nudge ·{" "}
                  <span className="text-ink">Del</span> remove ·{" "}
                  <span className="text-ink">Space</span> play
                </p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * A labelled −/value/+ stepper row for the note inspector, mirroring the
 * approved mockup. The value is presentational (note name, musical position,
 * length fraction); the callbacks apply the underlying command.
 */
function StepperRow({
  label,
  value,
  onDecrement,
  onIncrement,
  decrementLabel,
  incrementLabel,
  canDecrement = true,
  canIncrement = true,
}: {
  label: string;
  value: string;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementLabel: string;
  incrementLabel: string;
  canDecrement?: boolean;
  canIncrement?: boolean;
}) {
  return (
    <div className="border-subtle flex items-center justify-between gap-3 border-b py-2.5">
      <span className="text-muted font-mono text-[10px] tracking-widest uppercase">
        {label}
      </span>
      <span className="flex items-center gap-2.5">
        <button
          type="button"
          aria-label={decrementLabel}
          disabled={!canDecrement}
          onClick={onDecrement}
          className="border-strong text-muted hover:border-accent hover:text-accent grid h-6 w-6 place-items-center rounded-full border text-xs transition-colors disabled:opacity-40"
        >
          <FiMinus aria-hidden />
        </button>
        <span className="min-w-14 text-center font-mono text-sm tabular-nums">
          {value}
        </span>
        <button
          type="button"
          aria-label={incrementLabel}
          disabled={!canIncrement}
          onClick={onIncrement}
          className="border-strong text-muted hover:border-accent hover:text-accent grid h-6 w-6 place-items-center rounded-full border text-xs transition-colors disabled:opacity-40"
        >
          <FiPlus aria-hidden />
        </button>
      </span>
    </div>
  );
}

function KvRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-subtle flex items-center justify-between gap-3 border-b py-2 last:border-b-0">
      <span className="text-muted font-mono text-[10px] tracking-widest uppercase">
        {label}
      </span>
      <span className="truncate text-right font-mono text-xs tabular-nums">
        {value}
      </span>
    </div>
  );
}
