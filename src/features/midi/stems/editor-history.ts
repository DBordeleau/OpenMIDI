import type { MidiNoteV1 } from "@/features/studio/manifest/v2";
import {
  applyMidiStemCommand,
  type MidiCommandState,
  type MidiStemCommand,
} from "../semantic-commands";

export const MIDI_EDITOR_HISTORY_LIMIT = 100;

export type MidiEditorHistory = {
  past: readonly (readonly MidiNoteV1[])[];
  notes: readonly MidiNoteV1[];
  future: readonly (readonly MidiNoteV1[])[];
};

export function createMidiEditorHistory(
  notes: readonly MidiNoteV1[],
): MidiEditorHistory {
  return { past: [], notes, future: [] };
}

export function executeMidiEditorCommand(
  history: MidiEditorHistory,
  durationTicks: number,
  command: MidiStemCommand,
): MidiEditorHistory {
  const next = applyMidiStemCommand(
    { durationTicks, notes: history.notes },
    command,
  );
  if (next.notes === history.notes) return history;
  return {
    past: [...history.past, history.notes].slice(-MIDI_EDITOR_HISTORY_LIMIT),
    notes: next.notes,
    future: [],
  };
}

export function replaceMidiEditorNotes(
  history: MidiEditorHistory,
  notes: MidiCommandState["notes"],
): MidiEditorHistory {
  return {
    past: [...history.past, history.notes].slice(-MIDI_EDITOR_HISTORY_LIMIT),
    notes,
    future: [],
  };
}

export function undoMidiEditor(history: MidiEditorHistory): MidiEditorHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    notes: previous,
    future: [history.notes, ...history.future].slice(
      0,
      MIDI_EDITOR_HISTORY_LIMIT,
    ),
  };
}

export function redoMidiEditor(history: MidiEditorHistory): MidiEditorHistory {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, history.notes].slice(-MIDI_EDITOR_HISTORY_LIMIT),
    notes: next,
    future: history.future.slice(1),
  };
}
