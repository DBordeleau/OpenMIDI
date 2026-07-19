import {
  COMPOSITE_STUDIO_ENGINE_VERSION,
  MIDI_PPQ,
  parseMidiStemVersion,
  parseWorkspaceManifestV2,
  type MidiNoteV1,
  type MidiStemVersionV1,
  type WorkspaceManifestV2,
} from "@/features/studio/manifest/v2";
import { SYNTH_PRESETS_V1 } from "./presets";

function uuid(value: number) {
  return `10000000-0000-4000-8000-${value.toString(16).padStart(12, "0")}`;
}

export type MidiFeasibilityFixture = {
  manifest: WorkspaceManifestV2;
  stemVersions: ReadonlyMap<string, MidiStemVersionV1>;
};

export function createMidiNotes(count: number, idOffset = 0): MidiNoteV1[] {
  return Array.from({ length: count }, (_, index) => ({
    noteId: uuid(100_000 + idOffset + index),
    pitch: 48 + (index % 36),
    velocity: 64 + (index % 48),
    startTick: index * 60,
    durationTicks: 48,
  }));
}

export function createMidiFeasibilityFixture(
  trackCount: number,
  notesPerTrack: number,
): MidiFeasibilityFixture {
  const durationTicks = Math.max(480, notesPerTrack * 60 + 120);
  const stemVersions = new Map<string, MidiStemVersionV1>();
  const tracks = Array.from({ length: trackCount }, (_, index) => {
    const stemVersionId = uuid(20_000 + index);
    const preset = SYNTH_PRESETS_V1[index % 6];
    stemVersions.set(
      stemVersionId,
      parseMidiStemVersion({
        stemVersionId,
        stemId: uuid(30_000 + index),
        version: 1,
        creatorId: uuid(40_000 + index),
        parentStemVersionId: null,
        name: `Feasibility stem ${index + 1}`,
        defaultPresetId: preset.presetId,
        defaultPresetVersion: preset.version,
        ppq: MIDI_PPQ,
        durationTicks,
        contentSha256: (index + 1).toString(16).padStart(64, "0"),
        notes: createMidiNotes(notesPerTrack, index * notesPerTrack),
      }),
    );
    return {
      kind: "midi" as const,
      trackId: uuid(10_000 + index),
      name: `MIDI track ${index + 1}`,
      instrumentId: null,
      presetId: preset.presetId,
      presetVersion: preset.version,
      gainDb: -6,
      pan: 0,
      muted: false,
      soloed: false,
      sortOrder: index,
      clips: [
        {
          clipId: uuid(50_000 + index),
          midiStemVersionId: stemVersionId,
          startTick: 0,
          durationTicks,
          sourceStartTick: 0,
          loop: false,
        },
      ],
    };
  });

  return {
    manifest: parseWorkspaceManifestV2({
      manifestVersion: 2,
      engine: "openmidi-composite",
      engineVersion: COMPOSITE_STUDIO_ENGINE_VERSION,
      projectId: uuid(1),
      tempoBpm: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      durationTicks,
      tracks,
    }),
    stemVersions,
  };
}

export const MIDI_SINGLE_TRACK_FIXTURE = createMidiFeasibilityFixture(1, 16);
export const MIDI_EIGHT_TRACK_FIXTURE = createMidiFeasibilityFixture(8, 250);
export const MIDI_MAX_SCHEDULE_FIXTURE = createMidiFeasibilityFixture(
  16,
  1_024,
);
export const MIDI_PIANO_ROLL_2000_NOTES = createMidiNotes(2_000);
