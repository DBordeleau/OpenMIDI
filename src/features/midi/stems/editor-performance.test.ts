import { describe, expect, it } from "vitest";
import { createMidiNotes } from "../fixtures";
import {
  createMidiEditorHistory,
  executeMidiEditorCommand,
} from "./editor-history";

describe("maximum standalone MIDI editor fixture", () => {
  it("keeps a 2,048-note semantic edit and payload bounded", () => {
    const notes = createMidiNotes(2_048);
    const selected = notes.slice(0, 128).map(({ noteId }) => noteId);
    const startedAt = performance.now();
    const moved = executeMidiEditorCommand(
      createMidiEditorHistory(notes),
      130_000,
      {
        type: "moveNotes",
        noteIds: selected,
        deltaTicks: 60,
        deltaPitch: 1,
      },
    );
    const elapsedMs = performance.now() - startedAt;
    const payloadBytes = new TextEncoder().encode(
      JSON.stringify({
        name: "Maximum fixture",
        defaultPresetId: "warm-poly",
        defaultPresetVersion: 1,
        ppq: 480,
        durationTicks: 130_000,
        notes: moved.notes,
      }),
    ).byteLength;

    expect(moved.notes).toHaveLength(2_048);
    expect(elapsedMs).toBeLessThan(250);
    expect(payloadBytes).toBeLessThan(512 * 1_024);
  });
});
