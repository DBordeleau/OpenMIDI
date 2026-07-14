import { describe, expect, it } from "vitest";
import { MIDI_PPQ } from "@/features/studio/manifest/v2";
import { createMidiStemDraftSchema, midiStemContentSchema } from "./schema";

const id = (suffix: string) =>
  `10000000-0000-4000-8000-${suffix.padStart(12, "0")}`;

describe("standalone MIDI stem validation", () => {
  it("accepts a bounded canonical draft content shape", () => {
    expect(
      midiStemContentSchema.parse({
        name: "Night chords",
        defaultPresetId: "warm-poly",
        defaultPresetVersion: 1,
        ppq: MIDI_PPQ,
        durationTicks: 7_680,
        notes: [
          {
            noteId: id("1"),
            pitch: 60,
            velocity: 96,
            startTick: 0,
            durationTicks: 480,
          },
        ],
      }).notes,
    ).toHaveLength(1);
  });

  it("rejects unsupported presets and preset-specific pitches", () => {
    const base = {
      name: "Bass",
      defaultPresetVersion: 1,
      ppq: MIDI_PPQ,
      durationTicks: 7_680,
      notes: [
        {
          noteId: id("2"),
          pitch: 90,
          velocity: 96,
          startTick: 0,
          durationTicks: 480,
        },
      ],
    };
    expect(
      midiStemContentSchema.safeParse({
        ...base,
        defaultPresetId: "round-bass",
      }).success,
    ).toBe(false);
    expect(
      midiStemContentSchema.safeParse({
        ...base,
        defaultPresetId: "remote-sample-url",
      }).success,
    ).toBe(false);
  });

  it("requires an exact parent only for derive entry", () => {
    expect(
      createMidiStemDraftSchema.safeParse({
        requestId: id("3"),
        name: "Derived",
        entryMode: "derive",
        parentStemVersionId: null,
      }).success,
    ).toBe(false);
    expect(
      createMidiStemDraftSchema.safeParse({
        requestId: id("3"),
        name: "Imported",
        entryMode: "import",
        parentStemVersionId: null,
      }).success,
    ).toBe(true);
  });
});
