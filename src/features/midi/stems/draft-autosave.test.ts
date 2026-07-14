import { describe, expect, it } from "vitest";
import {
  getMidiDraftAutosaveDelay,
  initialMidiDraftSaveState,
  reduceMidiDraftSave,
} from "./draft-autosave";

describe("MIDI draft autosave state", () => {
  it("tracks save, offline, and conflict recovery states", () => {
    const edited = reduceMidiDraftSave(initialMidiDraftSaveState, {
      type: "edit",
    });
    expect(reduceMidiDraftSave(edited, { type: "save" }).status).toBe("saving");
    expect(reduceMidiDraftSave(edited, { type: "offline" }).status).toBe(
      "offline",
    );
    const conflict = reduceMidiDraftSave(edited, { type: "conflict" });
    expect(reduceMidiDraftSave(conflict, { type: "edit" })).toBe(conflict);
  });

  it("debounces without exceeding the maximum wait", () => {
    expect(getMidiDraftAutosaveDelay(1_000, 1_100)).toBe(1_000);
    expect(getMidiDraftAutosaveDelay(1_000, 5_500)).toBe(500);
    expect(getMidiDraftAutosaveDelay(1_000, 7_000)).toBe(0);
  });
});
