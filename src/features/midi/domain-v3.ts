import { z } from "zod";

export const MIDI_V3_PPQ = 480 as const;
export const MIDI_V3_MAX_TRACKS = 16;
export const MIDI_V3_MAX_CLIPS_PER_TRACK = 32;
export const MIDI_V3_MAX_NOTES_PER_PATTERN = 2_048;
export const MIDI_V3_MAX_RESOLVED_NOTES = 16_384;
export const MIDI_V3_MAX_PROJECT_MINUTES = 10;
export const MIDI_V3_MAX_TEMPO_BPM = 300;
export const MIDI_V3_MAX_DURATION_TICKS =
  MIDI_V3_MAX_PROJECT_MINUTES * 60 * MIDI_V3_MAX_TEMPO_BPM * MIDI_V3_PPQ;

export const MIDI_V3_ENGINE_ID = "openmidi-midi" as const;
export const MIDI_V3_ENGINE_VERSION =
  "openmidi-midi-3_tone-15.1.22_presets-1" as const;
export const MIDI_V3_REUSE_LICENSE = {
  code: "CC-BY-4.0",
  version: "4.0",
  url: "https://creativecommons.org/licenses/by/4.0/",
} as const;

const uuidSchema = z.uuid();
const nonnegativeTickSchema = z.number().int().nonnegative();
const positiveTickSchema = z
  .number()
  .int()
  .positive()
  .max(MIDI_V3_MAX_DURATION_TICKS);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const createdAtSchema = z.iso.datetime({ offset: true });

export const midiNoteV3Schema = z
  .object({
    noteId: uuidSchema,
    startTick: nonnegativeTickSchema,
    durationTicks: positiveTickSchema,
    pitch: z.number().int().min(0).max(127),
    velocity: z.number().int().min(1).max(127),
  })
  .strict();

export const patternContentV3Schema = z
  .object({
    ppq: z.literal(MIDI_V3_PPQ),
    durationTicks: positiveTickSchema,
    notes: z.array(midiNoteV3Schema).max(MIDI_V3_MAX_NOTES_PER_PATTERN),
  })
  .strict()
  .superRefine(({ durationTicks, notes }, context) => {
    const noteIds = new Set<string>();
    notes.forEach((note, index) => {
      if (noteIds.has(note.noteId)) {
        context.addIssue({
          code: "custom",
          message: "Duplicate noteId",
          path: ["notes", index, "noteId"],
        });
      }
      noteIds.add(note.noteId);
      if (note.startTick + note.durationTicks > durationTicks) {
        context.addIssue({
          code: "custom",
          message: "Note exceeds pattern duration",
          path: ["notes", index],
        });
      }
    });
  });

export const midiPatternV3Schema = z
  .object({
    midiPatternId: uuidSchema,
    ownerId: uuidSchema,
    sourceMidiPatternId: uuidSchema.nullable(),
    createdAt: createdAtSchema,
  })
  .strict();

const reuseLicenseSchema = z
  .object({
    code: z.literal(MIDI_V3_REUSE_LICENSE.code),
    version: z.literal(MIDI_V3_REUSE_LICENSE.version),
    url: z.literal(MIDI_V3_REUSE_LICENSE.url),
  })
  .strict();

export const midiPatternVersionV3Schema = patternContentV3Schema
  .safeExtend({
    midiPatternVersionId: uuidSchema,
    midiPatternId: uuidSchema,
    version: z.number().int().positive(),
    creatorId: uuidSchema,
    creatorCreditName: z.string().trim().min(1).max(120),
    parentMidiPatternVersionId: uuidSchema.nullable(),
    sourceMidiPatternVersionId: uuidSchema.nullable(),
    contentSha256: sha256Schema,
    noteCount: z
      .number()
      .int()
      .nonnegative()
      .max(MIDI_V3_MAX_NOTES_PER_PATTERN),
    reuseLicense: reuseLicenseSchema.nullable(),
    createdAt: createdAtSchema,
  })
  .superRefine(({ noteCount, notes }, context) => {
    if (noteCount !== notes.length) {
      context.addIssue({
        code: "custom",
        message: "noteCount must equal notes.length",
        path: ["noteCount"],
      });
    }
  });

export const workspaceClipV3Schema = z
  .object({
    clipId: uuidSchema,
    midiPatternVersionId: uuidSchema,
    startTick: nonnegativeTickSchema,
    durationTicks: positiveTickSchema,
    sourceStartTick: nonnegativeTickSchema,
    loop: z.boolean(),
  })
  .strict();

const trackFields = {
  trackId: uuidSchema,
  sortOrder: z.number().int().nonnegative(),
  name: z.string().trim().min(1).max(120),
  presetId: z.string().trim().min(1).max(64),
  presetVersion: z.number().int().positive(),
  gainDb: z.number().finite().min(-60).max(6),
  pan: z.number().finite().min(-1).max(1),
  muted: z.boolean(),
  soloed: z.boolean(),
} as const;

export const workspaceTrackV3Schema = z
  .object({
    ...trackFields,
    clips: z.array(workspaceClipV3Schema).max(MIDI_V3_MAX_CLIPS_PER_TRACK),
  })
  .strict();

export const arrangementClipV3Schema = workspaceClipV3Schema;
export const arrangementTrackV3Schema = workspaceTrackV3Schema;

export type MidiNoteV3 = z.infer<typeof midiNoteV3Schema>;
export type PatternContentV3 = z.infer<typeof patternContentV3Schema>;
export type MidiPatternV3 = z.infer<typeof midiPatternV3Schema>;
export type MidiPatternVersionV3 = z.infer<typeof midiPatternVersionV3Schema>;
export type WorkspaceClipV3 = z.infer<typeof workspaceClipV3Schema>;
export type WorkspaceTrackV3 = z.infer<typeof workspaceTrackV3Schema>;
export type ArrangementClipV3 = z.infer<typeof arrangementClipV3Schema>;
export type ArrangementTrackV3 = z.infer<typeof arrangementTrackV3Schema>;
