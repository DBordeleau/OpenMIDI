import { describe, expect, it } from "vitest";
import { createPatternVersionDiffClip } from "./pattern-version-diff";
import type { MidiLibraryHistoryVersion } from "@/features/midi-library/types";

const patternId = "20000000-0000-4000-8000-000000000001";
const creatorId = "20000000-0000-4000-8000-000000000002";
const base: MidiLibraryHistoryVersion = {
  midiPatternVersionId: "20000000-0000-4000-8000-000000000003",
  midiPatternId: patternId,
  versionNumber: 1,
  creatorId,
  creatorCreditName: "Creator",
  parentMidiPatternVersionId: null,
  sourceMidiPatternVersionId: null,
  ppq: 480,
  durationTicks: 960,
  noteCount: 2,
  contentSha256: "a".repeat(64),
  reuseLicenseCode: "CC-BY-4.0",
  reuseLicenseVersion: "4.0",
  reuseLicenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  createdAt: "2026-07-17T20:00:00.000Z",
  notes: [
    {
      noteId: "20000000-0000-4000-8000-000000000010",
      startTick: 0,
      durationTicks: 240,
      pitch: 60,
      velocity: 90,
    },
    {
      noteId: "20000000-0000-4000-8000-000000000011",
      startTick: 240,
      durationTicks: 240,
      pitch: 62,
      velocity: 90,
    },
  ],
};

describe("pattern-version shared DIFF adapter", () => {
  it("uses shared non-color Added, Changed, and Removed semantics", () => {
    const after: MidiLibraryHistoryVersion = {
      ...base,
      midiPatternVersionId: "20000000-0000-4000-8000-000000000004",
      versionNumber: 2,
      notes: [
        { ...base.notes[0]!, durationTicks: 480, pitch: 61 },
        {
          noteId: "20000000-0000-4000-8000-000000000012",
          startTick: 480,
          durationTicks: 240,
          pitch: 67,
          velocity: 80,
        },
      ],
    };
    const clip = createPatternVersionDiffClip({
      before: base,
      after,
      title: "Phrase",
    });
    expect(
      clip.noteChanges.map(({ state, marker, label }) => ({
        state,
        marker,
        label,
      })),
    ).toEqual([
      { state: "changed", marker: "~", label: "Changed" },
      { state: "removed", marker: "−", label: "Removed" },
      { state: "added", marker: "+", label: "Added" },
    ]);
    expect(
      clip.noteChanges.find((note) => note.state === "removed")?.overlay
        .lineStyle,
    ).toBe("dashed");
  });

  it("rejects versions from different pattern histories", () => {
    expect(() =>
      createPatternVersionDiffClip({
        before: base,
        after: { ...base, midiPatternId: creatorId },
        title: "Phrase",
      }),
    ).toThrow("midi_library_comparison_pattern_mismatch");
  });
});
