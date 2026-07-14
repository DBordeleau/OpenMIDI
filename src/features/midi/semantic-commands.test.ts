import { describe, expect, it } from "vitest";
import { createMidiNotes } from "./fixtures";
import { applyMidiStemCommand } from "./semantic-commands";
import type { MidiCommandState } from "./semantic-commands";

describe("Jam-owned MIDI semantic commands", () => {
  it("moves, resizes, changes velocity, quantizes, duplicates, and deletes", () => {
    const [note] = createMidiNotes(1);
    let state: MidiCommandState = { durationTicks: 1_920, notes: [note] };
    state = applyMidiStemCommand(state, {
      type: "moveNotes",
      noteIds: [note.noteId],
      deltaTicks: 65,
      deltaPitch: 2,
    });
    state = applyMidiStemCommand(state, {
      type: "resizeNotes",
      noteIds: [note.noteId],
      deltaTicks: 12,
    });
    state = applyMidiStemCommand(state, {
      type: "setVelocity",
      noteIds: [note.noteId],
      velocity: 99,
    });
    state = applyMidiStemCommand(state, {
      type: "quantizeNotes",
      noteIds: [note.noteId],
      division: "1/16",
    });
    expect(state.notes[0]).toMatchObject({
      pitch: 50,
      startTick: 120,
      durationTicks: 60,
      velocity: 99,
    });

    const copy = {
      ...state.notes[0],
      noteId: "10000000-0000-4000-8000-000000099999",
      startTick: 240,
    };
    state = applyMidiStemCommand(state, {
      type: "duplicateNotes",
      noteIds: [note.noteId],
      copies: [copy],
    });
    state = applyMidiStemCommand(state, {
      type: "deleteNotes",
      noteIds: [note.noteId],
    });
    expect(state.notes).toEqual([copy]);
  });

  it("rejects commands that escape canonical stem bounds", () => {
    const [note] = createMidiNotes(1);
    expect(() =>
      applyMidiStemCommand(
        { durationTicks: 480, notes: [note] },
        {
          type: "moveNotes",
          noteIds: [note.noteId],
          deltaTicks: -1,
          deltaPitch: 0,
        },
      ),
    ).toThrow();
  });
});
