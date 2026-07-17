import { MIDI_V3_PPQ } from "@/features/midi/domain-v3";
import {
  MIDI_DIFF_VISUAL_STATES,
  type MidiDiffChangeState,
  type MidiDiffClip,
  type MidiDiffNote,
  type MidiDiffNoteGeometry,
} from "./types";

export const MIDI_DIFF_CONTEXT_NOTE_LIMIT = 64;
const TICK_PADDING = MIDI_V3_PPQ / 2;
const PITCH_PADDING = 2;

export type MidiDiffViewport = {
  startTick: number;
  endTick: number;
  minPitch: number;
  maxPitch: number;
};

export type MidiDiffOverlayRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MidiDiffOverlayChange = MidiDiffNote & {
  beforeRect: MidiDiffOverlayRect | null;
  afterRect: MidiDiffOverlayRect | null;
};

export type MidiDiffOverlayContext = {
  noteId: string;
  geometry: MidiDiffNoteGeometry;
  rect: MidiDiffOverlayRect;
};

export type MidiDiffNoteOverlayModel = {
  viewport: MidiDiffViewport;
  counts: Record<MidiDiffChangeState, number>;
  changes: MidiDiffOverlayChange[];
  context: MidiDiffOverlayContext[];
};

function noteOrder(
  left: {
    noteId: string;
    before: MidiDiffNoteGeometry | null;
    after: MidiDiffNoteGeometry | null;
  },
  right: {
    noteId: string;
    before: MidiDiffNoteGeometry | null;
    after: MidiDiffNoteGeometry | null;
  },
) {
  const leftGeometry = left.after ?? left.before;
  const rightGeometry = right.after ?? right.before;
  return (
    (leftGeometry?.startTick ?? 0) - (rightGeometry?.startTick ?? 0) ||
    (leftGeometry?.pitch ?? 0) - (rightGeometry?.pitch ?? 0) ||
    left.noteId.localeCompare(right.noteId)
  );
}

function oneSidedChange(
  noteId: string,
  geometry: MidiDiffNoteGeometry,
  state: "added" | "removed",
): MidiDiffNote {
  const visual = MIDI_DIFF_VISUAL_STATES[state];
  return {
    noteId,
    state,
    marker: visual.marker,
    label: visual.label,
    before: state === "removed" ? geometry : null,
    after: state === "added" ? geometry : null,
    changedFacets: [],
    details: [],
    overlay: {
      beforeVisible: visual.beforeVisible,
      afterVisible: visual.afterVisible,
      lineStyle: visual.lineStyle,
    },
  };
}

function overlayChanges(clip: MidiDiffClip): MidiDiffNote[] {
  const changes = [...clip.noteChanges];
  if (clip.before === null && clip.after !== null) {
    for (const note of clip.noteContext) {
      if (note.after)
        changes.push(oneSidedChange(note.noteId, note.after, "added"));
    }
  }
  if (clip.after === null && clip.before !== null) {
    for (const note of clip.noteContext) {
      if (note.before)
        changes.push(oneSidedChange(note.noteId, note.before, "removed"));
    }
  }
  return changes.sort(noteOrder);
}

function viewportFor(
  changes: readonly MidiDiffNote[],
  clip: MidiDiffClip,
): MidiDiffViewport {
  const changedGeometry = changes.flatMap((note) =>
    [note.before, note.after].filter(
      (geometry): geometry is MidiDiffNoteGeometry => geometry !== null,
    ),
  );
  const contextGeometry = clip.noteContext.flatMap((note) =>
    [note.before, note.after].filter(
      (geometry): geometry is MidiDiffNoteGeometry => geometry !== null,
    ),
  );
  const geometry =
    changedGeometry.length > 0 ? changedGeometry : contextGeometry;
  if (geometry.length === 0) {
    return { startTick: 0, endTick: MIDI_V3_PPQ, minPitch: 58, maxPitch: 62 };
  }
  const startTick = Math.max(
    0,
    Math.min(...geometry.map((note) => note.startTick)) - TICK_PADDING,
  );
  const endTick = Math.max(
    startTick + MIDI_V3_PPQ,
    Math.max(...geometry.map((note) => note.startTick + note.durationTicks)) +
      TICK_PADDING,
  );
  return {
    startTick,
    endTick,
    minPitch: Math.max(
      0,
      Math.min(...geometry.map((note) => note.pitch)) - PITCH_PADDING,
    ),
    maxPitch: Math.min(
      127,
      Math.max(...geometry.map((note) => note.pitch)) + PITCH_PADDING,
    ),
  };
}

export function midiDiffNoteRect(
  geometry: MidiDiffNoteGeometry,
  viewport: MidiDiffViewport,
): MidiDiffOverlayRect {
  const tickSpan = viewport.endTick - viewport.startTick;
  const pitchRows = viewport.maxPitch - viewport.minPitch + 1;
  return {
    x: (geometry.startTick - viewport.startTick) / tickSpan,
    y: (viewport.maxPitch - geometry.pitch) / pitchRows,
    width: geometry.durationTicks / tickSpan,
    height: 1 / pitchRows,
  };
}

function intersectsViewport(
  geometry: MidiDiffNoteGeometry,
  viewport: MidiDiffViewport,
) {
  return (
    geometry.startTick < viewport.endTick &&
    geometry.startTick + geometry.durationTicks > viewport.startTick &&
    geometry.pitch >= viewport.minPitch &&
    geometry.pitch <= viewport.maxPitch
  );
}

export function createMidiDiffNoteOverlay(
  clip: MidiDiffClip,
): MidiDiffNoteOverlayModel {
  const rawChanges = overlayChanges(clip);
  const viewport = viewportFor(rawChanges, clip);
  const changes = rawChanges.map((note) => ({
    ...note,
    beforeRect: note.before ? midiDiffNoteRect(note.before, viewport) : null,
    afterRect: note.after ? midiDiffNoteRect(note.after, viewport) : null,
  }));
  const counts = { added: 0, changed: 0, removed: 0 };
  for (const note of changes) counts[note.state] += 1;

  const context = clip.noteContext
    .filter(() => clip.before !== null && clip.after !== null)
    .map((note) => ({
      noteId: note.noteId,
      geometry: note.after ?? note.before,
    }))
    .filter(
      (note): note is { noteId: string; geometry: MidiDiffNoteGeometry } =>
        note.geometry !== null && intersectsViewport(note.geometry, viewport),
    )
    .sort((left, right) =>
      noteOrder(
        { noteId: left.noteId, before: null, after: left.geometry },
        { noteId: right.noteId, before: null, after: right.geometry },
      ),
    )
    .slice(0, MIDI_DIFF_CONTEXT_NOTE_LIMIT)
    .map((note) => ({
      ...note,
      rect: midiDiffNoteRect(note.geometry, viewport),
    }));

  return { viewport, counts, changes, context };
}

function geometryText(geometry: MidiDiffNoteGeometry | null) {
  if (!geometry) return "Not present";
  return `${geometry.pitchName}, ${geometry.positionLabel}, ${geometry.durationLabel}, velocity ${geometry.velocity}`;
}

export function midiDiffNoteText(
  note: MidiDiffNote,
  sideLabels: { before: string; after: string },
) {
  if (note.state === "added") {
    return `${note.marker} Added: ${geometryText(note.after)}.`;
  }
  if (note.state === "removed") {
    return `${note.marker} Removed: ${geometryText(note.before)}.`;
  }
  const details = note.details
    .map((detail) => `${detail.label} from ${detail.before} to ${detail.after}`)
    .join("; ");
  return `${note.marker} Changed. ${sideLabels.before}: ${geometryText(note.before)}. ${sideLabels.after}: ${geometryText(note.after)}.${details ? ` Changes: ${details}.` : ""}`;
}
