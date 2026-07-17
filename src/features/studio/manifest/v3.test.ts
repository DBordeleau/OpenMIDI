import { describe, expect, it } from "vitest";
import { MIDI_SINGLE_TRACK_FIXTURE } from "@/features/midi/fixtures";
import { convertMidiOnlyManifestV2ToV3 } from "./v2-to-v3";
import {
  reconstructManifestV3,
  parseArrangementManifestV3,
  parseManifestV3,
  parseMidiPatternVersionV3,
  parseWorkspaceManifestV3,
  projectManifestV3,
  sha256ManifestV3,
  sha256PatternContentV3,
  validateManifestPatternReferencesV3,
} from "./v3";
import {
  V3_IDS,
  V3_MANIFEST_BEFORE,
  V3_PATTERN_VERSION_1,
} from "./v3.fixtures";

describe("MIDI manifest v3", () => {
  it("uses the frozen engine contract and canonical track, clip, and note order", () => {
    expect(V3_MANIFEST_BEFORE.engine).toBe("jam-session-midi");
    expect(V3_MANIFEST_BEFORE.engineVersion).toBe(
      "jam-session-midi-3_tone-15.1.22_presets-1",
    );
    expect(V3_MANIFEST_BEFORE.tracks.map(({ trackId }) => trackId)).toEqual([
      V3_IDS.trackA,
      V3_IDS.trackB,
    ]);
    expect(V3_PATTERN_VERSION_1.notes.map(({ noteId }) => noteId)).toEqual([
      V3_IDS.noteA,
      V3_IDS.noteB,
    ]);
  });

  it("round trips normalized arrangement projections exactly", () => {
    expect(
      reconstructManifestV3(projectManifestV3(V3_MANIFEST_BEFORE)),
    ).toEqual(V3_MANIFEST_BEFORE);
  });

  it("distinguishes workspace snapshots from immutable arrangement manifests", () => {
    expect(() =>
      parseWorkspaceManifestV3({
        ...V3_MANIFEST_BEFORE,
        workspaceId: V3_IDS.workspace,
      }),
    ).not.toThrow();
    expect(() =>
      parseArrangementManifestV3({
        ...V3_MANIFEST_BEFORE,
        workspaceId: V3_IDS.workspace,
      }),
    ).toThrow("cannot contain workspaceId");
    expect(() => parseArrangementManifestV3(V3_MANIFEST_BEFORE)).not.toThrow();
    expect(() => parseWorkspaceManifestV3(V3_MANIFEST_BEFORE)).toThrow(
      "require workspaceId",
    );
  });

  it("produces deterministic order-independent content and manifest hashes", async () => {
    const patternContent = {
      ppq: V3_PATTERN_VERSION_1.ppq,
      durationTicks: V3_PATTERN_VERSION_1.durationTicks,
      notes: V3_PATTERN_VERSION_1.notes,
    };
    expect(
      await sha256PatternContentV3({
        ...patternContent,
        notes: [...patternContent.notes].reverse(),
      }),
    ).toBe(await sha256PatternContentV3(patternContent));
    expect(await sha256PatternContentV3(patternContent)).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(
      await sha256ManifestV3({
        ...V3_MANIFEST_BEFORE,
        tracks: [...V3_MANIFEST_BEFORE.tracks].reverse(),
      }),
    ).toBe(await sha256ManifestV3(V3_MANIFEST_BEFORE));
  });

  it("rejects unknown fields, duplicate IDs, and invalid bounds", () => {
    expect(() =>
      parseManifestV3({
        ...V3_MANIFEST_BEFORE,
        binaryObjectPath: "not-part-of-manifest-v3",
      }),
    ).toThrow();
    expect(() =>
      parseManifestV3({
        ...V3_MANIFEST_BEFORE,
        tracks: [
          V3_MANIFEST_BEFORE.tracks[0],
          {
            ...V3_MANIFEST_BEFORE.tracks[1],
            clips: [V3_MANIFEST_BEFORE.tracks[0].clips[0]],
          },
        ],
      }),
    ).toThrow("Duplicate clipId");
    expect(() =>
      parseManifestV3({
        ...V3_MANIFEST_BEFORE,
        tracks: [
          {
            ...V3_MANIFEST_BEFORE.tracks[0],
            clips: [
              {
                ...V3_MANIFEST_BEFORE.tracks[0].clips[0],
                startTick: V3_MANIFEST_BEFORE.durationTicks,
              },
            ],
          },
          V3_MANIFEST_BEFORE.tracks[1],
        ],
      }),
    ).toThrow("Clip exceeds project duration");
  });

  it("validates immutable pattern note counts, IDs, and duration bounds", () => {
    expect(() =>
      parseMidiPatternVersionV3({ ...V3_PATTERN_VERSION_1, noteCount: 1 }),
    ).toThrow("noteCount must equal notes.length");
    expect(() =>
      parseMidiPatternVersionV3({
        ...V3_PATTERN_VERSION_1,
        notes: [
          {
            ...V3_PATTERN_VERSION_1.notes[0],
            startTick: V3_PATTERN_VERSION_1.durationTicks,
          },
          V3_PATTERN_VERSION_1.notes[1],
        ],
      }),
    ).toThrow("Note exceeds pattern duration");
  });

  it("validates pattern references and source bounds", () => {
    const patterns = new Map([
      [V3_PATTERN_VERSION_1.midiPatternVersionId, V3_PATTERN_VERSION_1],
    ]);
    expect(() =>
      validateManifestPatternReferencesV3(V3_MANIFEST_BEFORE, patterns),
    ).not.toThrow();
    expect(() =>
      validateManifestPatternReferencesV3(V3_MANIFEST_BEFORE, new Map()),
    ).toThrow("Missing MIDI pattern version");
  });

  it("converts MIDI-only v2 manifests", () => {
    const converted = convertMidiOnlyManifestV2ToV3(
      MIDI_SINGLE_TRACK_FIXTURE.manifest,
      { workspaceId: V3_IDS.workspace, musicalKey: "c-major" },
    );
    expect(converted.tracks[0].clips[0].midiPatternVersionId).toBe(
      [...MIDI_SINGLE_TRACK_FIXTURE.stemVersions.keys()][0],
    );
    expect(converted).not.toHaveProperty("kind");
  });
});
