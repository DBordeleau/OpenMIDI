import { describe, expect, it } from "vitest";
import { createMidiNotes } from "../fixtures";
import {
  createMidiEditorHistory,
  executeMidiEditorCommand,
  MIDI_EDITOR_HISTORY_LIMIT,
  redoMidiEditor,
  undoMidiEditor,
} from "./editor-history";

describe("standalone MIDI editor history", () => {
  it("undoes and redoes semantic note commands", () => {
    const [note] = createMidiNotes(1);
    const initial = createMidiEditorHistory([note]);
    const moved = executeMidiEditorCommand(initial, 1_920, {
      type: "moveNotes",
      noteIds: [note.noteId],
      deltaTicks: 120,
      deltaPitch: 1,
    });
    expect(moved.notes[0]).toMatchObject({ startTick: 120, pitch: 49 });
    expect(undoMidiEditor(moved).notes).toEqual(initial.notes);
    expect(redoMidiEditor(undoMidiEditor(moved)).notes).toEqual(moved.notes);
  });

  it("bounds history and clears redo after a new command", () => {
    const [note] = createMidiNotes(1);
    let history = createMidiEditorHistory([note]);
    for (let index = 0; index < MIDI_EDITOR_HISTORY_LIMIT + 10; index += 1) {
      history = executeMidiEditorCommand(history, 100_000, {
        type: "moveNotes",
        noteIds: [note.noteId],
        deltaTicks: 1,
        deltaPitch: 0,
      });
    }
    expect(history.past).toHaveLength(MIDI_EDITOR_HISTORY_LIMIT);
    const undone = undoMidiEditor(history);
    expect(undone.future).toHaveLength(1);
    expect(
      executeMidiEditorCommand(undone, 100_000, {
        type: "setVelocity",
        noteIds: [note.noteId],
        velocity: 100,
      }).future,
    ).toHaveLength(0);
  });

  it("treats a positioned block copy as one undoable semantic command", () => {
    const notes = createMidiNotes(2);
    const copies = notes.map((note, index) => ({
      ...note,
      noteId: `20000000-0000-4000-8000-00000000000${index + 1}`,
      startTick: note.startTick + 120,
      pitch: note.pitch + 1,
    }));
    const initial = createMidiEditorHistory(notes);
    const copied = executeMidiEditorCommand(initial, 1_920, {
      type: "duplicateNotes",
      noteIds: notes.map(({ noteId }) => noteId),
      copies,
    });

    expect(copied.notes).toHaveLength(4);
    expect(copied.past).toEqual([notes]);
    expect(undoMidiEditor(copied).notes).toEqual(notes);
    expect(redoMidiEditor(undoMidiEditor(copied)).notes).toEqual(copied.notes);
  });
});
