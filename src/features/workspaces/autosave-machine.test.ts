import { describe, expect, it } from "vitest";
import {
  getAutosaveDelay,
  initialAutosaveState,
  reduceAutosave,
} from "./autosave-machine";

describe("workspace autosave state", () => {
  it("moves through edit, save, and acknowledgement", () => {
    const unsaved = reduceAutosave(initialAutosaveState, { type: "edit" });
    const saving = reduceAutosave(unsaved, { type: "save" });
    expect(reduceAutosave(saving, { type: "saved" })).toEqual({
      status: "saved",
      message: "Saved",
    });
  });

  it("keeps a conflict blocking later edits", () => {
    const conflict = reduceAutosave(initialAutosaveState, {
      type: "conflict",
    });
    expect(reduceAutosave(conflict, { type: "edit" })).toBe(conflict);
  });

  it("distinguishes offline and recoverable error states", () => {
    expect(
      reduceAutosave(initialAutosaveState, { type: "offline" }).status,
    ).toBe("offline");
    expect(
      reduceAutosave(initialAutosaveState, {
        type: "error",
        message: "Retry saving.",
      }),
    ).toMatchObject({ status: "error", message: "Retry saving." });
  });

  it("debounces edits but never waits past the maximum interval", () => {
    expect(getAutosaveDelay(1_000, 1_250)).toBe(1_000);
    expect(getAutosaveDelay(1_000, 5_500)).toBe(500);
    expect(getAutosaveDelay(1_000, 6_500)).toBe(0);
  });
});
