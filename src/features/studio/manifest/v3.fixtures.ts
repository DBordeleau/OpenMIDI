import {
  MIDI_V3_ENGINE_ID,
  MIDI_V3_ENGINE_VERSION,
  MIDI_V3_PPQ,
  type MidiPatternVersionV3,
} from "@/features/midi/domain-v3";
import {
  parseArrangementManifestV3,
  parseMidiPatternVersionV3,
  type ArrangementManifestV3,
} from "./v3";

function uuid(value: number) {
  return `30000000-0000-4000-8000-${value.toString(16).padStart(12, "0")}`;
}

const createdAt = "2026-07-16T12:00:00Z";

export const V3_IDS = {
  project: uuid(1),
  workspace: uuid(2),
  creator: uuid(3),
  pattern: uuid(10),
  patternVersion1: uuid(11),
  patternVersion2: uuid(12),
  trackA: uuid(20),
  trackB: uuid(21),
  trackC: uuid(22),
  clipA: uuid(30),
  clipB: uuid(31),
  clipC: uuid(32),
  noteA: uuid(40),
  noteB: uuid(41),
  noteC: uuid(42),
} as const;

export const V3_PATTERN_VERSION_1 = parseMidiPatternVersionV3({
  midiPatternVersionId: V3_IDS.patternVersion1,
  midiPatternId: V3_IDS.pattern,
  version: 1,
  creatorId: V3_IDS.creator,
  creatorCreditName: "Loop Maker",
  parentMidiPatternVersionId: null,
  sourceMidiPatternVersionId: null,
  contentSha256: "1".repeat(64),
  noteCount: 2,
  ppq: MIDI_V3_PPQ,
  durationTicks: 960,
  reuseLicense: null,
  createdAt,
  notes: [
    {
      noteId: V3_IDS.noteB,
      startTick: 240,
      durationTicks: 120,
      pitch: 64,
      velocity: 80,
    },
    {
      noteId: V3_IDS.noteA,
      startTick: 0,
      durationTicks: 120,
      pitch: 60,
      velocity: 90,
    },
  ],
});

export const V3_PATTERN_VERSION_2 = parseMidiPatternVersionV3({
  ...V3_PATTERN_VERSION_1,
  midiPatternVersionId: V3_IDS.patternVersion2,
  version: 2,
  parentMidiPatternVersionId: V3_IDS.patternVersion1,
  contentSha256: "2".repeat(64),
  noteCount: 2,
  notes: [
    {
      noteId: V3_IDS.noteC,
      startTick: 480,
      durationTicks: 120,
      pitch: 67,
      velocity: 70,
    },
    {
      noteId: V3_IDS.noteA,
      startTick: 120,
      durationTicks: 240,
      pitch: 61,
      velocity: 100,
    },
  ],
});

const baseHeader = {
  manifestVersion: 3 as const,
  engine: MIDI_V3_ENGINE_ID,
  engineVersion: MIDI_V3_ENGINE_VERSION,
  projectId: V3_IDS.project,
  tempoBpm: 120,
  timeSignature: { numerator: 4, denominator: 4 as const },
  musicalKey: "c-major" as const,
  ppq: MIDI_V3_PPQ,
  durationTicks: 1_920,
};

export const V3_MANIFEST_BEFORE = parseArrangementManifestV3({
  ...baseHeader,
  tracks: [
    {
      trackId: V3_IDS.trackB,
      sortOrder: 1,
      name: "Counter line",
      presetId: "warm-keys",
      presetVersion: 1,
      gainDb: -6,
      pan: 0.25,
      muted: false,
      soloed: false,
      clips: [
        {
          clipId: V3_IDS.clipB,
          midiPatternVersionId: V3_IDS.patternVersion1,
          startTick: 960,
          durationTicks: 480,
          sourceStartTick: 0,
          loop: false,
        },
      ],
    },
    {
      trackId: V3_IDS.trackA,
      sortOrder: 0,
      name: "Lead",
      presetId: "soft-lead",
      presetVersion: 1,
      gainDb: -6,
      pan: 0,
      muted: false,
      soloed: false,
      clips: [
        {
          clipId: V3_IDS.clipA,
          midiPatternVersionId: V3_IDS.patternVersion1,
          startTick: 0,
          durationTicks: 480,
          sourceStartTick: 0,
          loop: false,
        },
      ],
    },
  ],
});

export const V3_MANIFEST_AFTER = parseArrangementManifestV3({
  ...baseHeader,
  tempoBpm: 128,
  timeSignature: { numerator: 3, denominator: 4 },
  musicalKey: "d-minor",
  durationTicks: 2_400,
  tracks: [
    {
      trackId: V3_IDS.trackA,
      sortOrder: 1,
      name: "Lead hook",
      presetId: "saw-lead",
      presetVersion: 1,
      gainDb: -3,
      pan: 0,
      muted: false,
      soloed: false,
      clips: [
        {
          clipId: V3_IDS.clipA,
          midiPatternVersionId: V3_IDS.patternVersion2,
          startTick: 240,
          durationTicks: 960,
          sourceStartTick: 120,
          loop: true,
        },
      ],
    },
    {
      trackId: V3_IDS.trackC,
      sortOrder: 0,
      name: "Bass",
      presetId: "sub-bass",
      presetVersion: 1,
      gainDb: -6,
      pan: 0,
      muted: false,
      soloed: false,
      clips: [
        {
          clipId: V3_IDS.clipC,
          midiPatternVersionId: V3_IDS.patternVersion1,
          startTick: 0,
          durationTicks: 480,
          sourceStartTick: 0,
          loop: false,
        },
      ],
    },
  ],
});

export type V3Fixture = {
  manifest: ArrangementManifestV3;
  patternVersions: MidiPatternVersionV3[];
};

export const V3_DIFF_BEFORE: V3Fixture = {
  manifest: V3_MANIFEST_BEFORE,
  patternVersions: [V3_PATTERN_VERSION_1],
};

export const V3_DIFF_AFTER: V3Fixture = {
  manifest: V3_MANIFEST_AFTER,
  patternVersions: [V3_PATTERN_VERSION_2, V3_PATTERN_VERSION_1],
};
