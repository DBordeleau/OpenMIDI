"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  FiCopy,
  FiDisc,
  FiCornerUpLeft,
  FiCornerUpRight,
  FiHelpCircle,
  FiMousePointer,
  FiPlay,
  FiPlus,
  FiSave,
  FiRadio,
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
import { SYNTH_PRESETS_V1, resolveSynthPreset } from "../presets";
import {
  publishMidiStemVersionAction,
  saveMidiStemDraftAction,
} from "./actions";
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
import { useMidiPerformance } from "./use-midi-performance.client";

const PLAYBACK_BPM = 120;
const PITCH_ROW_HEIGHT = 22;
const PIANO_KEY_WIDTH = 88;
const MIN_PIXELS_PER_BEAT = 48;
const MAX_PIXELS_PER_BEAT = 160;
const DEFAULT_PIXELS_PER_BEAT = 88;
const MIN_NOTE_WIDTH = 7;
const RESIZE_HANDLE_WIDTH = 10;
const AUDITION_SECONDS = 0.18;

const inputClass =
  "focus:border-accent border-strong bg-surface mt-2 min-h-11 w-full rounded-control border px-3 py-2 transition-colors";
const secondaryButton =
  "border-strong hover:border-accent inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold disabled:opacity-45";

type Quantization = keyof typeof QUANTIZATION_TICKS;
type Viewport = {
  width: number;
  height: number;
  scrollLeft: number;
  scrollTop: number;
};
type DragGesture = {
  mode: "move" | "resize";
  pointerId: number;
  clientX: number;
  clientY: number;
  noteIds: readonly string[];
  notes: readonly MidiNoteV1[];
  lastAuditionPitch: number;
};

type AuditionVoice = {
  presetId: string;
  voice: PresetVoice;
};

function isBlackKey(pitch: number) {
  return [1, 3, 6, 8, 10].includes(pitch % 12);
}

function resizeHandleWidth(noteWidth: number) {
  return Math.min(RESIZE_HANDLE_WIDTH, Math.max(4, noteWidth / 3));
}

function pitchName(pitch: number) {
  const names = [
    "C",
    "C♯",
    "D",
    "D♯",
    "E",
    "F",
    "F♯",
    "G",
    "G♯",
    "A",
    "A♯",
    "B",
  ];
  return `${names[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
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

export function MidiStemEditor({ draft }: { draft: MidiStemDraft }) {
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
  const [pixelsPerBeat, setPixelsPerBeat] = useState(DEFAULT_PIXELS_PER_BEAT);
  const [viewport, setViewport] = useState<Viewport>({
    width: 900,
    height: 430,
    scrollLeft: 0,
    scrollTop: 0,
  });
  const [showShortcuts, setShowShortcuts] = useState(false);
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
  const lockVersionRef = useRef(draft.lockVersion);
  const contentSha256Ref = useRef(draft.contentSha256);
  const savingRef = useRef(false);
  const dirtySinceRef = useRef<number | null>(null);
  const editGenerationRef = useRef(0);
  const [editGeneration, setEditGeneration] = useState(0);
  const saveStatusRef = useRef<MidiDraftSaveStatus>(saveState.status);
  const gestureRef = useRef<DragGesture | null>(null);
  const voiceRef = useRef<PresetVoice | null>(null);
  const auditionVoiceRef = useRef<AuditionVoice | null>(null);
  const auditionRequestRef = useRef(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playheadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const notes = previewNotes ?? history.notes;
  const preset = resolveSynthPreset(presetId, 1);
  const selectedNotes = useMemo(
    () => history.notes.filter(({ noteId }) => selectedIds.has(noteId)),
    [history.notes, selectedIds],
  );
  const selectedNote = selectedNotes.length === 1 ? selectedNotes[0] : null;
  const pitchCount = preset.maxNote - preset.minNote + 1;
  const rollHeight = pitchCount * PITCH_ROW_HEIGHT;
  const timelineWidth = Math.max(
    viewport.width - PIANO_KEY_WIDTH,
    (draft.durationTicks / MIDI_PPQ) * pixelsPerBeat,
  );
  const rollWidth = PIANO_KEY_WIDTH + timelineWidth;
  const payloadBytes = useMemo(
    () =>
      new TextEncoder().encode(
        contentFingerprint({ name, presetId, notes: history.notes }),
      ).byteLength,
    [history.notes, name, presetId],
  );

  useEffect(() => {
    saveStatusRef.current = saveState.status;
  }, [saveState.status]);

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
  }, []);

  const stopAudition = useCallback(() => {
    auditionRequestRef.current += 1;
    auditionVoiceRef.current?.voice.allNotesOff();
    auditionVoiceRef.current?.voice.dispose();
    auditionVoiceRef.current = null;
  }, []);

  const auditionNote = useCallback(
    async (pitch: number, velocity = 96) => {
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
        entry.voice.triggerAttackRelease(
          pitch,
          AUDITION_SECONDS,
          when,
          velocity / 127,
        );
      } catch {
        // Audition is a progressive enhancement; editing remains available when
        // the browser has not granted audio playback yet.
      }
    },
    [presetId],
  );

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
    commitTake: commitRecordedTake,
    announce: setNotice,
  });
  const visiblePlayheadTick =
    performance.status === "idle" ? playheadTick : performance.playheadTick;
  const performancePitches = useMemo(() => {
    const base = (performance.octave + 1) * 12;
    return Array.from({ length: 13 }, (_, offset) => base + offset).filter(
      (pitch) => pitch >= preset.minNote && pitch <= preset.maxNote,
    );
  }, [performance.octave, preset.maxNote, preset.minNote]);

  useEffect(() => stopPlayback, [stopPlayback]);
  useEffect(() => stopAudition, [stopAudition]);

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
      const result = await saveMidiStemDraftAction({
        draftId: draft.draftId,
        requestId: crypto.randomUUID(),
        expectedLockVersion: lockVersionRef.current,
        content,
      });
      if (!result.ok) {
        dispatchSave({
          type: result.code === "conflict" ? "conflict" : "error",
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
    const roll = rollRef.current;
    if (!roll) return;
    const update = () =>
      setViewport((current) => ({
        ...current,
        width: roll.clientWidth,
        height: roll.clientHeight,
      }));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(roll);
    return () => observer.disconnect();
  }, []);

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
    const surfaceColor = color("--color-surface", "#1e1524");
    const borderColor = color("--color-border", "rgba(255,255,255,.1)");
    const strongBorder = color(
      "--color-border-strong",
      "rgba(255,255,255,.16)",
    );
    const textColor = color("--color-text", "#fff7f0");
    const mutedColor = color("--color-text-muted", "#b8abbc");
    const accent = color("--color-accent", "#ff8d63");
    const accent2 = color("--color-accent-2", "#ffc879");
    context.fillStyle = canvasColor;
    context.fillRect(0, 0, viewport.width, viewport.height);

    const firstRow = Math.max(
      0,
      Math.floor(viewport.scrollTop / PITCH_ROW_HEIGHT),
    );
    const lastRow = Math.min(
      pitchCount,
      Math.ceil((viewport.scrollTop + viewport.height) / PITCH_ROW_HEIGHT),
    );
    context.font = "11px ui-monospace, monospace";
    context.textBaseline = "middle";
    for (let row = firstRow; row < lastRow; row += 1) {
      const pitch = preset.maxNote - row;
      const y = row * PITCH_ROW_HEIGHT - viewport.scrollTop;
      const isBlack = isBlackKey(pitch);
      context.fillStyle = isBlack ? canvasColor : surfaceColor;
      context.fillRect(
        PIANO_KEY_WIDTH,
        y,
        viewport.width - PIANO_KEY_WIDTH,
        PITCH_ROW_HEIGHT,
      );
      context.strokeStyle = borderColor;
      context.beginPath();
      context.moveTo(PIANO_KEY_WIDTH, y + PITCH_ROW_HEIGHT);
      context.lineTo(viewport.width, y + PITCH_ROW_HEIGHT);
      context.stroke();

      context.fillStyle = textColor;
      context.fillRect(0, y, PIANO_KEY_WIDTH, PITCH_ROW_HEIGHT);
      context.strokeStyle = strongBorder;
      context.strokeRect(0, y, PIANO_KEY_WIDTH, PITCH_ROW_HEIGHT);
      if (isBlack) {
        context.fillStyle = canvasColor;
        context.fillRect(
          PIANO_KEY_WIDTH * 0.38,
          y + 1,
          PIANO_KEY_WIDTH * 0.62,
          PITCH_ROW_HEIGHT - 2,
        );
      }
      context.fillStyle = isBlack
        ? mutedColor
        : pitch % 12 === 0
          ? canvasColor
          : surfaceColor;
      context.textAlign = "right";
      context.fillText(
        pitchName(pitch),
        PIANO_KEY_WIDTH - 7,
        y + PITCH_ROW_HEIGHT / 2,
      );
      context.textAlign = "left";
    }
    context.fillStyle = strongBorder;
    context.fillRect(PIANO_KEY_WIDTH - 1, 0, 2, viewport.height);

    const visibleStartTick = Math.max(
      0,
      ((viewport.scrollLeft - PIANO_KEY_WIDTH) / pixelsPerBeat) * MIDI_PPQ,
    );
    const visibleEndTick = Math.min(
      draft.durationTicks,
      ((viewport.scrollLeft + viewport.width) / pixelsPerBeat) * MIDI_PPQ,
    );
    const grid = QUANTIZATION_TICKS[quantization];
    const firstGrid = Math.floor(visibleStartTick / grid) * grid;
    for (let tick = firstGrid; tick <= visibleEndTick; tick += grid) {
      const x =
        PIANO_KEY_WIDTH +
        (tick / MIDI_PPQ) * pixelsPerBeat -
        viewport.scrollLeft;
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
      const y = row * PITCH_ROW_HEIGHT - viewport.scrollTop + 3;
      if (y > viewport.height || y + PITCH_ROW_HEIGHT < 0) continue;
      const x =
        PIANO_KEY_WIDTH +
        (note.startTick / MIDI_PPQ) * pixelsPerBeat -
        viewport.scrollLeft;
      const width = Math.max(
        MIN_NOTE_WIDTH,
        (note.durationTicks / MIDI_PPQ) * pixelsPerBeat,
      );
      context.fillStyle = selectedIds.has(note.noteId) ? accent2 : accent;
      context.globalAlpha = 0.45 + (note.velocity / 127) * 0.55;
      context.fillRect(x, y, width, PITCH_ROW_HEIGHT - 6);
      context.globalAlpha = 1;
      context.fillStyle = canvasColor;
      const handleWidth = resizeHandleWidth(width);
      context.fillRect(
        x + width - handleWidth,
        y,
        handleWidth,
        PITCH_ROW_HEIGHT - 6,
      );
      context.strokeStyle = selectedIds.has(note.noteId) ? accent2 : accent;
      context.beginPath();
      context.moveTo(x + width - 4, y + 4);
      context.lineTo(x + width - 4, y + PITCH_ROW_HEIGHT - 10);
      context.stroke();
    }

    const playheadX =
      PIANO_KEY_WIDTH +
      (visiblePlayheadTick / MIDI_PPQ) * pixelsPerBeat -
      viewport.scrollLeft;
    context.strokeStyle = accent2;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(playheadX, 0);
    context.lineTo(playheadX, viewport.height);
    context.stroke();
  }, [
    draft.durationTicks,
    notes,
    pixelsPerBeat,
    pitchCount,
    visiblePlayheadTick,
    preset.maxNote,
    quantization,
    selectedIds,
    viewport,
  ]);

  function noteAtPointer(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const worldX = clientX - rect.left + viewport.scrollLeft - PIANO_KEY_WIDTH;
    const worldY = clientY - rect.top + viewport.scrollTop;
    for (const note of [...history.notes].reverse()) {
      const x = (note.startTick / MIDI_PPQ) * pixelsPerBeat;
      const width = Math.max(
        MIN_NOTE_WIDTH,
        (note.durationTicks / MIDI_PPQ) * pixelsPerBeat,
      );
      const y = (preset.maxNote - note.pitch) * PITCH_ROW_HEIGHT;
      if (
        worldX >= x &&
        worldX <= x + width &&
        worldY >= y &&
        worldY <= y + PITCH_ROW_HEIGHT
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
    const row = Math.floor(
      (clientY - rect.top + viewport.scrollTop) / PITCH_ROW_HEIGHT,
    );
    return Math.max(
      preset.minNote,
      Math.min(preset.maxNote, preset.maxNote - row),
    );
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX - rect.left < PIANO_KEY_WIDTH) {
      void auditionNote(pitchAtPointer(event.clientY));
      return;
    }
    const hit = noteAtPointer(event.clientX, event.clientY);
    if (!hit) {
      if (!event.shiftKey) setSelectedIds(new Set());
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
    event.currentTarget.setPointerCapture(event.pointerId);
    gestureRef.current = {
      mode: hit.resize ? "resize" : "move",
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      noteIds: [...nextSelection],
      notes: history.notes,
      lastAuditionPitch: hit.note.pitch,
    };
    event.currentTarget.style.cursor = hit.resize ? "ew-resize" : "grabbing";
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX - rect.left < PIANO_KEY_WIDTH) {
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
      gesture.mode === "resize" ? "ew-resize" : "grabbing";
    const grid = QUANTIZATION_TICKS[quantization];
    const deltaTicks =
      Math.round(
        (((event.clientX - gesture.clientX) / pixelsPerBeat) * MIDI_PPQ) / grid,
      ) * grid;
    const deltaPitch = -Math.round(
      (event.clientY - gesture.clientY) / PITCH_ROW_HEIGHT,
    );
    try {
      const command: MidiStemCommand =
        gesture.mode === "resize"
          ? { type: "resizeNotes", noteIds: gesture.noteIds, deltaTicks }
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
      setPreviewNotes(next.notes);
      if (gesture.mode === "move") {
        const primaryNote = next.notes.find(
          ({ noteId }) => noteId === gesture.noteIds[0],
        );
        if (primaryNote && primaryNote.pitch !== gesture.lastAuditionPitch) {
          gesture.lastAuditionPitch = primaryNote.pitch;
          void auditionNote(primaryNote.pitch, primaryNote.velocity);
        }
      }
    } catch {
      // Keep the last valid preview while the pointer is outside canonical bounds.
    }
  }

  function finishPointerGesture(event: React.PointerEvent<HTMLCanvasElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (previewNotes) {
      setHistory((current) => replaceMidiEditorNotes(current, previewNotes));
      markEdited();
      setNotice(
        gesture.mode === "resize"
          ? "Note length changed. Autosave is listening."
          : "Selection moved. Autosave is listening.",
      );
    }
    setPreviewNotes(null);
    gestureRef.current = null;
    event.currentTarget.style.cursor = "crosshair";
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleContextMenu(event: React.MouseEvent<HTMLCanvasElement>) {
    const hit = noteAtPointer(event.clientX, event.clientY);
    if (!hit) return;
    event.preventDefault();
    commitCommand(
      { type: "deleteNotes", noteIds: [hit.note.noteId] },
      `${pitchName(hit.note.pitch)} removed.`,
      [],
    );
  }

  function handleDoubleClick(event: React.MouseEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX - rect.left < PIANO_KEY_WIDTH) return;
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
        ? ((clientX - rect.left + viewport.scrollLeft - PIANO_KEY_WIDTH) /
            pixelsPerBeat) *
          MIDI_PPQ
        : visiblePlayheadTick;
    const startTick = Math.max(0, Math.round(rawTick / grid) * grid);
    const rawRow =
      rect && clientY !== undefined
        ? Math.floor(
            (clientY - rect.top + viewport.scrollTop) / PITCH_ROW_HEIGHT,
          )
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
    void auditionNote(note.pitch, note.velocity);
  }

  function addStarterPattern() {
    if (history.notes.length > MAX_MIDI_NOTES_PER_STEM - 4) {
      setNotice("There is not enough room for the four-note starter pattern.");
      return;
    }
    const pitches =
      preset.family === "drums"
        ? [36, 42, 38, 42]
        : [
            preset.minNote + 12,
            preset.minNote + 16,
            preset.minNote + 19,
            preset.minNote + 24,
          ];
    const start = history.notes.length
      ? Math.max(
          ...history.notes.map((note) => note.startTick + note.durationTicks),
        )
      : 0;
    const starter = pitches.map((pitch, index): MidiNoteV1 => ({
      noteId: crypto.randomUUID(),
      pitch: Math.min(preset.maxNote, pitch),
      velocity: index % 2 === 0 ? 100 : 84,
      startTick: start + index * MIDI_PPQ,
      durationTicks: preset.family === "drums" ? 120 : MIDI_PPQ,
    }));
    if (
      starter.some(
        (note) => note.startTick + note.durationTicks > draft.durationTicks,
      )
    ) {
      setNotice("There is not enough room at the end for a starter pattern.");
      return;
    }
    setHistory((current) =>
      replaceMidiEditorNotes(
        current,
        canonicalizeMidiNotes([...current.notes, ...starter]),
      ),
    );
    setSelectedIds(new Set(starter.map(({ noteId }) => noteId)));
    setNotice("Four-note starter pattern added.");
    markEdited();
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
    } else if (modifier && event.key.toLowerCase() === "a") {
      event.preventDefault();
      setSelectedIds(new Set(history.notes.map(({ noteId }) => noteId)));
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

  async function play() {
    if (!history.notes.length) {
      setNotice("Add a note before pressing play.");
      return;
    }
    stopAudition();
    performance.stopRecording();
    stopPlayback();
    setPlaying(true);
    setPlayheadTick(0);
    try {
      const { createPresetVoice, resumeMidiAudioContext } =
        await import("../browser-engine/preset-voice.client");
      const contextTime = await resumeMidiAudioContext();
      const voice = await createPresetVoice(presetId, 1);
      voiceRef.current = voice;
      const leadIn = 0.05;
      const secondsPerTick = 60 / (PLAYBACK_BPM * MIDI_PPQ);
      for (const note of history.notes) {
        voice.triggerAttackRelease(
          note.pitch,
          note.durationTicks * secondsPerTick,
          contextTime + leadIn + note.startTick * secondsPerTick,
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
        (leadIn + endTick * secondsPerTick + 1.5) * 1_000,
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
    const result = await publishMidiStemVersionAction({
      draftId: draft.draftId,
      requestId: crypto.randomUUID(),
      expectedLockVersion: lockVersionRef.current,
      expectedContentSha256: contentSha256Ref.current,
    });
    if (!result.ok) {
      setPublicationState({
        status: "error",
        message:
          result.code === "conflict"
            ? "The draft changed before publication. Reload its latest save and try again."
            : result.code === "limit"
              ? "Your prototype library has reached 500 immutable versions."
              : "This version couldn’t be frozen right now.",
      });
      return;
    }
    setPublicationState({
      status: "published",
      message: `Version ${result.version} is immutable and credited to ${result.creatorCreditName}.`,
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
        void auditionNote(value, selectedNote.velocity);
      }
    }
  }

  return (
    <section
      className="mt-8"
      onKeyDown={handleEditorKeyDown}
      onKeyUp={handleEditorKeyUp}
    >
      <div className="rounded-card border-subtle bg-surface shadow-raised border p-4 sm:p-6">
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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <label className="font-semibold">
            Stem name
            <input
              className={inputClass}
              value={name}
              maxLength={120}
              onChange={(event) => {
                setName(event.target.value);
                markEdited();
              }}
            />
          </label>
          <label className="font-semibold">
            Sound
            <select
              className={inputClass}
              value={presetId}
              onChange={(event) => {
                const nextPreset = resolveSynthPreset(event.target.value, 1);
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
              {SYNTH_PRESETS_V1.map((item) => (
                <option key={item.presetId} value={item.presetId}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-muted mt-3 text-sm">{preset.description}</p>
        {preset.drumMap && (
          <p className="text-muted mt-2 text-sm">
            Kit map:{" "}
            {Object.entries(preset.drumMap)
              .map(([pitch, label]) => `${pitch} ${label}`)
              .join(" · ")}
          </p>
        )}

        <section
          className="border-subtle bg-surface-soft rounded-control mt-5 border p-4"
          aria-labelledby="performance-heading"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 id="performance-heading" className="text-lg font-semibold">
                Perform a take
              </h2>
              <p className="text-muted mt-1 text-sm">
                Use the piano, A–K QWERTY keys, or optional hardware MIDI. Raw
                timing stays untouched until you choose Quantize.
              </p>
            </div>
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

          <div className="mt-4 flex flex-wrap items-end gap-3">
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
                    Math.max(1, Math.min(127, event.target.valueAsNumber || 1)),
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
            className="mt-4 flex max-w-full gap-1 overflow-x-auto pb-2"
            aria-label="On-screen piano"
          >
            {performancePitches.map((pitch) => (
              <button
                key={pitch}
                type="button"
                className={`focus-visible:ring-accent min-h-20 min-w-12 rounded-b-md border px-2 text-xs font-semibold focus-visible:ring-2 ${
                  isBlackKey(pitch)
                    ? "border-strong bg-canvas text-ink"
                    : "border-subtle bg-ink text-canvas"
                }`}
                aria-label={`Play ${pitchName(pitch)}, MIDI note ${pitch}`}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  performance.noteOn(
                    pitch,
                    performance.defaultVelocity,
                    globalThis.performance.now(),
                  );
                }}
                onPointerUp={() =>
                  performance.noteOff(pitch, globalThis.performance.now())
                }
                onPointerCancel={() =>
                  performance.noteOff(pitch, globalThis.performance.now())
                }
                onLostPointerCapture={() =>
                  performance.noteOff(pitch, globalThis.performance.now())
                }
              >
                {preset.drumMap?.[String(pitch)] ?? pitchName(pitch)}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
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
                hardware input{performance.hardwareInputCount === 1 ? "" : "s"}{" "}
                connected
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
        </section>

        <div className="border-subtle mt-5 flex flex-wrap items-center gap-2 border-y py-4">
          <button
            type="button"
            onClick={() => void play()}
            disabled={playing}
            className="cta-gradient text-accent-contrast inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-60"
          >
            <FiPlay aria-hidden /> {playing ? "Playing…" : "Play stem"}
          </button>
          <button
            type="button"
            onClick={stopPlayback}
            disabled={!playing}
            className={secondaryButton}
          >
            <FiSquare aria-hidden /> Stop
          </button>
          <button
            type="button"
            onClick={() => void performSave()}
            disabled={
              saveState.status === "saved" ||
              saveState.status === "saving" ||
              saveState.status === "conflict" ||
              !name.trim()
            }
            className={secondaryButton}
          >
            <FiSave aria-hidden />
            {saveState.status === "saving" ? "Saving…" : "Save now"}
          </button>
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
              ? "Freezing version…"
              : "Save to My stems"}
          </button>
          <span
            role="status"
            className={`ml-auto text-sm ${
              saveState.status === "error" || saveState.status === "conflict"
                ? "text-danger"
                : "text-muted"
            }`}
          >
            {saveState.message}
          </span>
          {(saveState.status === "offline" || saveState.status === "error") && (
            <button
              type="button"
              className="text-accent text-sm font-semibold underline"
              onClick={() => void performSave()}
            >
              Retry
            </button>
          )}
          {saveState.status === "conflict" && (
            <button
              type="button"
              className="text-accent text-sm font-semibold underline"
              onClick={() => window.location.reload()}
            >
              Reload draft
            </button>
          )}
        </div>
        {publicationState.message && (
          <p
            role="status"
            className={`mt-2 text-sm ${
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

        <div className="mt-5 flex flex-wrap items-end gap-2">
          <button
            type="button"
            className={secondaryButton}
            onClick={undo}
            disabled={!history.past.length}
          >
            <FiCornerUpLeft aria-hidden /> Undo
          </button>
          <button
            type="button"
            className={secondaryButton}
            onClick={redo}
            disabled={!history.future.length}
          >
            <FiCornerUpRight aria-hidden /> Redo
          </button>
          <button
            type="button"
            className={secondaryButton}
            onClick={() => addNoteAt()}
          >
            <FiPlus aria-hidden /> Add note
          </button>
          <button
            type="button"
            className={secondaryButton}
            onClick={addStarterPattern}
          >
            <FiPlus aria-hidden /> Add starter pattern
          </button>
          <button
            type="button"
            className={secondaryButton}
            onClick={duplicateSelection}
            disabled={!selectedIds.size}
          >
            <FiCopy aria-hidden /> Duplicate
          </button>
          <button
            type="button"
            className={secondaryButton}
            onClick={deleteSelection}
            disabled={!selectedIds.size}
          >
            <FiTrash2 aria-hidden /> Delete
          </button>
          <label className="text-sm font-semibold">
            Grid
            <select
              className="border-strong bg-surface rounded-control ml-2 min-h-11 border px-3"
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
            className={secondaryButton}
            onClick={quantizeSelection}
            disabled={!selectedIds.size}
          >
            <FiZap aria-hidden /> Quantize
          </button>
          <button
            type="button"
            className={secondaryButton}
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
            className={secondaryButton}
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
          <button
            type="button"
            className={secondaryButton}
            onClick={() => setShowShortcuts((value) => !value)}
          >
            <FiHelpCircle aria-hidden /> Shortcuts
          </button>
        </div>

        {showShortcuts && (
          <div className="border-subtle bg-surface-soft rounded-control mt-3 border p-4 text-sm">
            <p className="font-semibold">Piano-roll keyboard controls</p>
            <p className="text-muted mt-1">
              Arrows move selected notes; Shift + Left/Right resizes; Delete
              removes; Ctrl/Cmd + D duplicates; Ctrl/Cmd + Z undoes; Ctrl/Cmd +
              Shift + Z or Ctrl/Cmd + Y redoes; Ctrl/Cmd + A selects all. Text
              fields keep their normal shortcuts. Right-click a note to remove
              it, or click a piano key to preview its sound.
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">Piano roll</h2>
            <p className="text-muted mt-1 text-sm">
              {history.notes.length.toLocaleString()} of 2,048 notes ·{" "}
              {selectedIds.size} selected · {Math.ceil(payloadBytes / 1024)} KiB
              draft payload
            </p>
          </div>
          <p className="text-muted inline-flex items-center gap-2 text-sm">
            <FiMousePointer aria-hidden /> Double-click empty space to add. Drag
            notes, resize from the gripped right edge, or right-click to remove.
          </p>
        </div>

        <div
          ref={rollRef}
          className="border-strong bg-canvas rounded-control mt-3 h-[28rem] max-h-[70vh] overflow-auto border"
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
              data-testid="midi-piano-roll"
              onDoubleClick={handleDoubleClick}
              onContextMenu={handleContextMenu}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishPointerGesture}
              onPointerCancel={finishPointerGesture}
              onPointerLeave={(event) => {
                if (!gestureRef.current)
                  event.currentTarget.style.cursor = "crosshair";
              }}
            />
          </div>
        </div>

        <p aria-live="polite" className="text-muted mt-3 min-h-5 text-sm">
          {notice ||
            "Every grid action has an equivalent in the note inspector or keyboard shortcuts."}
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <section
          className="rounded-card border-subtle bg-surface border p-5"
          aria-labelledby="note-list-heading"
        >
          <h2 id="note-list-heading" className="text-lg font-semibold">
            Note list
          </h2>
          <p className="text-muted mt-2 text-sm">
            Select one or several notes. This list mirrors the visual grid.
          </p>
          <select
            multiple
            size={10}
            className="border-strong bg-surface-soft rounded-control mt-4 w-full border p-2 font-mono text-sm"
            aria-label="Notes in stem"
            value={[...selectedIds]}
            onChange={(event) => setSelectedIds(selectedValues(event))}
          >
            {history.notes.map((note, index) => (
              <option key={note.noteId} value={note.noteId}>
                {index + 1}. {pitchName(note.pitch)} · tick {note.startTick} ·{" "}
                {note.durationTicks} long · velocity {note.velocity}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`${secondaryButton} mt-3 w-full`}
            onClick={() =>
              setSelectedIds(new Set(history.notes.map(({ noteId }) => noteId)))
            }
            disabled={!history.notes.length}
          >
            Select all notes
          </button>
        </section>

        <section
          className="rounded-card border-subtle bg-surface border p-5"
          aria-labelledby="note-inspector-heading"
        >
          <h2 id="note-inspector-heading" className="text-lg font-semibold">
            Note inspector
          </h2>
          {!selectedNote ? (
            <div className="border-strong bg-surface-soft rounded-control mt-4 border border-dashed p-6 text-center">
              <p className="font-semibold">
                {selectedIds.size > 1
                  ? `${selectedIds.size} notes selected`
                  : "No note selected"}
              </p>
              <p className="text-muted mt-2 text-sm">
                {selectedIds.size > 1
                  ? "Use velocity, quantize, duplicate, move, or delete controls on the selection. Choose one note for exact fields."
                  : "Choose a note in the list or on the piano roll to edit exact values."}
              </p>
              {selectedIds.size > 1 && (
                <label className="mt-4 block text-left text-sm font-semibold">
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
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <InspectorField
                key={`pitch-${selectedNote.noteId}-${selectedNote.pitch}`}
                label="MIDI pitch"
                detail={pitchName(selectedNote.pitch)}
                min={preset.minNote}
                max={preset.maxNote}
                value={selectedNote.pitch}
                onCommit={(value) => updateSelectedNote("pitch", value)}
              />
              <InspectorField
                key={`start-${selectedNote.noteId}-${selectedNote.startTick}`}
                label="Start tick"
                min={0}
                max={draft.durationTicks - selectedNote.durationTicks}
                value={selectedNote.startTick}
                onCommit={(value) => updateSelectedNote("startTick", value)}
              />
              <InspectorField
                key={`duration-${selectedNote.noteId}-${selectedNote.durationTicks}`}
                label="Duration ticks"
                min={1}
                max={draft.durationTicks - selectedNote.startTick}
                value={selectedNote.durationTicks}
                onCommit={(value) => updateSelectedNote("durationTicks", value)}
              />
              <InspectorField
                key={`velocity-${selectedNote.noteId}-${selectedNote.velocity}`}
                label="Velocity"
                min={1}
                max={127}
                value={selectedNote.velocity}
                onCommit={(value) => updateSelectedNote("velocity", value)}
              />
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function InspectorField({
  label,
  detail,
  min,
  max,
  value,
  onCommit,
}: {
  label: string;
  detail?: string;
  min: number;
  max: number;
  value: number;
  onCommit: (value: number) => void;
}) {
  return (
    <label className="text-sm font-semibold">
      {label}{" "}
      {detail && <span className="text-muted font-normal">({detail})</span>}
      <input
        className={inputClass}
        type="number"
        min={min}
        max={max}
        step={1}
        defaultValue={value}
        onBlur={(event) => onCommit(event.currentTarget.valueAsNumber)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </label>
  );
}
