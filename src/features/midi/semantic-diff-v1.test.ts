import { describe, expect, it } from "vitest";
import {
  V3_DIFF_AFTER,
  V3_DIFF_BEFORE,
  V3_IDS,
} from "@/features/studio/manifest/v3.fixtures";
import {
  diffMidiArrangementsV1,
  MIDI_SEMANTIC_DIFF_VERSION,
} from "./semantic-diff-v1";

describe("MIDI semantic diff v1", () => {
  it("returns the versioned empty result for unchanged canonical content", () => {
    expect(diffMidiArrangementsV1(V3_DIFF_BEFORE, V3_DIFF_BEFORE)).toEqual({
      algorithmVersion: MIDI_SEMANTIC_DIFF_VERSION,
      unchanged: true,
      metadata: [],
      tracks: [],
      clips: [],
      notes: [],
      lineage: [],
    });
  });

  it("deterministically reports metadata, track, clip, note, and lineage changes", () => {
    const diff = diffMidiArrangementsV1(V3_DIFF_BEFORE, V3_DIFF_AFTER);
    expect(diff.unchanged).toBe(false);
    expect(diff.metadata.map(({ field }) => field)).toEqual([
      "tempoBpm",
      "timeSignature",
      "musicalKey",
      "durationTicks",
    ]);
    expect(diff.tracks.map(({ trackId, kind }) => [trackId, kind])).toEqual([
      [V3_IDS.trackA, "changed"],
      [V3_IDS.trackB, "removed"],
      [V3_IDS.trackC, "added"],
    ]);
    expect(diff.tracks[0].changes.map(({ field }) => field)).toEqual([
      "name",
      "sortOrder",
      "presetId",
      "gainDb",
    ]);
    expect(diff.clips.map(({ clipId, kind }) => [clipId, kind])).toEqual([
      [V3_IDS.clipA, "changed"],
      [V3_IDS.clipB, "removed"],
      [V3_IDS.clipC, "added"],
    ]);
    expect(diff.clips[0].changes.map(({ field }) => field)).toEqual([
      "startTick",
      "durationTicks",
      "sourceStartTick",
      "loop",
      "midiPatternVersionId",
    ]);
    expect(diff.notes.map(({ noteId, kind }) => [noteId, kind])).toEqual([
      [V3_IDS.noteA, "changed"],
      [V3_IDS.noteB, "removed"],
      [V3_IDS.noteC, "added"],
    ]);
    expect(diff.notes[0].changes.map(({ field }) => field)).toEqual([
      "startTick",
      "durationTicks",
      "pitch",
      "velocity",
    ]);
    expect(diff.lineage).toHaveLength(1);
    expect(diff.lineage[0].changes.map(({ field }) => field)).toEqual([
      "parentMidiPatternVersionId",
    ]);
    expect(diffMidiArrangementsV1(V3_DIFF_BEFORE, V3_DIFF_AFTER)).toEqual(diff);
  });

  it("rejects duplicate pattern IDs at the trust boundary", () => {
    expect(() =>
      diffMidiArrangementsV1(V3_DIFF_BEFORE, {
        ...V3_DIFF_AFTER,
        patternVersions: [
          V3_DIFF_AFTER.patternVersions[0],
          V3_DIFF_AFTER.patternVersions[0],
        ],
      }),
    ).toThrow("Duplicate MIDI pattern version ID");
  });
});
