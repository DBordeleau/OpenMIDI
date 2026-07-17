import { describe, expect, it } from "vitest";
import type {
  MidiDiffChangeState,
  MidiDiffClip,
  MidiDiffNote,
  MidiDiffNoteGeometry,
} from "./types";
import { createMidiDiffNoteOverlay, midiDiffNoteText } from "./note-overlay";

function geometry(
  startTick: number,
  durationTicks: number,
  pitch: number,
  velocity: number,
): MidiDiffNoteGeometry {
  return {
    startTick,
    durationTicks,
    pitch,
    velocity,
    pitchName: `MIDI ${pitch}`,
    positionLabel: `Tick ${startTick}`,
    durationLabel: `${durationTicks} ticks`,
  };
}

function note(
  noteId: string,
  state: MidiDiffChangeState,
  before: MidiDiffNoteGeometry | null,
  after: MidiDiffNoteGeometry | null,
  fields: string[] = [],
): MidiDiffNote {
  const marker = state === "added" ? "+" : state === "changed" ? "~" : "−";
  return {
    noteId,
    state,
    marker,
    label: state[0].toUpperCase() + state.slice(1),
    before,
    after,
    changedFacets: fields,
    details: fields.map((field) => ({
      field,
      label: field,
      before: before
        ? String(before[field as keyof MidiDiffNoteGeometry])
        : "Not present",
      after: after
        ? String(after[field as keyof MidiDiffNoteGeometry])
        : "Not present",
    })),
    overlay: {
      beforeVisible: state !== "added",
      afterVisible: state !== "removed",
      lineStyle: state === "removed" ? "dashed" : "solid",
    },
  };
}

function clip(noteChanges: MidiDiffNote[]): MidiDiffClip {
  const pattern = {
    midiPatternVersionId: "pattern-version",
    midiPatternId: "pattern",
    version: 1,
    creatorCreditName: "Creator",
    parentMidiPatternVersionId: null,
    sourceMidiPatternVersionId: null,
    reuseLicenseCode: null,
    reuseLicenseUrl: null,
  };
  const side = {
    trackId: "track",
    trackName: "Lead",
    positionLabel: "Bar 1, beat 1",
    durationLabel: "4 beats",
    sourcePositionLabel: "Bar 1, beat 1",
    loopLabel: "Plays once",
    noteCount: noteChanges.length,
    pattern,
  };
  return {
    selectionId: "clip:clip",
    clipId: "clip",
    state: "changed",
    states: ["changed"],
    marker: "~",
    label: "Lead clip",
    contextLabel: "Bar 1, beat 1",
    before: side,
    after: side,
    details: [],
    noteChanges,
    noteContext: [],
    lineageDetails: [],
  };
}

describe("MIDI diff note overlay geometry", () => {
  it("projects added and removed notes from their authoritative side", () => {
    const added = note("added", "added", null, geometry(480, 120, 67, 90));
    const removed = note("removed", "removed", geometry(0, 240, 60, 80), null);
    const model = createMidiDiffNoteOverlay(clip([added, removed]));

    expect(model.counts).toEqual({ added: 1, changed: 0, removed: 1 });
    expect(model.changes[0]).toMatchObject({
      beforeRect: expect.any(Object),
      afterRect: null,
    });
    expect(model.changes[1]).toMatchObject({
      beforeRect: null,
      afterRect: expect.any(Object),
    });
  });

  it("shows distinct before and after geometry for moved, resized, and repitched notes", () => {
    const before = geometry(120, 120, 60, 90);
    const after = geometry(360, 360, 65, 90);
    const model = createMidiDiffNoteOverlay(
      clip([
        note("combined", "changed", before, after, [
          "startTick",
          "durationTicks",
          "pitch",
        ]),
      ]),
    );
    const changed = model.changes[0];

    expect(changed.afterRect?.x).toBeGreaterThan(changed.beforeRect?.x ?? 1);
    expect(changed.afterRect?.width).toBeGreaterThan(
      changed.beforeRect?.width ?? 1,
    );
    expect(changed.afterRect?.y).not.toBe(changed.beforeRect?.y);
    expect(model.viewport).toEqual({
      startTick: 0,
      endTick: 960,
      minPitch: 58,
      maxPitch: 67,
    });
  });

  it("retains identical geometry and explicit values for velocity-only changes", () => {
    const before = geometry(0, 240, 60, 64);
    const after = geometry(0, 240, 60, 112);
    const changed = note("velocity", "changed", before, after, ["velocity"]);
    const model = createMidiDiffNoteOverlay(clip([changed]));

    expect(model.changes[0].beforeRect).toEqual(model.changes[0].afterRect);
    expect(
      midiDiffNoteText(changed, { before: "Base", after: "Submitted" }),
    ).toContain("velocity 64");
    expect(
      midiDiffNoteText(changed, { before: "Base", after: "Submitted" }),
    ).toContain("velocity 112");
  });

  it("keeps a combined change as one note while listing every changed field", () => {
    const changed = note(
      "combined",
      "changed",
      geometry(0, 120, 60, 70),
      geometry(240, 360, 62, 100),
      ["startTick", "durationTicks", "pitch", "velocity"],
    );
    const model = createMidiDiffNoteOverlay(clip([changed]));
    const text = midiDiffNoteText(changed, {
      before: "Base",
      after: "Submitted",
    });

    expect(model.changes).toHaveLength(1);
    expect(text).toContain("startTick");
    expect(text).toContain("durationTicks");
    expect(text).toContain("pitch");
    expect(text).toContain("velocity");
  });
});
