import { z } from "zod";

export const MIDI_PPQ = 480 as const;
export const MAX_MIDI_NOTES_PER_STEM = 2_048;
export const MAX_RESOLVED_MIDI_NOTES_PER_PROJECT = 16_384;
export const MAX_MIDI_TRACKS = 16;
export const MAX_CLIPS_PER_TRACK = 32;
export const MAX_PROJECT_MINUTES = 10;
export const MAX_MIDI_STEM_DURATION_TICKS = 86_400_000;
export const COMPOSITE_STUDIO_ENGINE_VERSION =
  "jam-session-composite-2_tone-15.1.22";

const uuidSchema = z.uuid();
const tickSchema = z.number().int().nonnegative();
const positiveTickSchema = z.number().int().positive();
const mixerSchema = {
  gainDb: z.number().finite().min(-60).max(6),
  pan: z.number().finite().min(-1).max(1),
  muted: z.boolean(),
  soloed: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
} as const;

export const midiNoteV1Schema = z
  .object({
    noteId: uuidSchema,
    pitch: z.number().int().min(0).max(127),
    velocity: z.number().int().min(1).max(127),
    startTick: tickSchema,
    durationTicks: positiveTickSchema.max(MAX_MIDI_STEM_DURATION_TICKS),
  })
  .strict();

const stemContentSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    defaultPresetId: z.string().trim().min(1).max(64),
    defaultPresetVersion: z.number().int().positive(),
    ppq: z.literal(MIDI_PPQ),
    durationTicks: positiveTickSchema,
    notes: z.array(midiNoteV1Schema).max(MAX_MIDI_NOTES_PER_STEM),
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
          message: "Note exceeds stem duration",
          path: ["notes", index],
        });
      }
    });
  });

export const midiStemDraftV1Schema = stemContentSchema.safeExtend({
  draftId: uuidSchema,
  stemId: uuidSchema,
  ownerId: uuidSchema,
  parentStemVersionId: uuidSchema.nullable(),
  lockVersion: z.number().int().nonnegative(),
});

export const midiStemVersionV1Schema = stemContentSchema.safeExtend({
  stemVersionId: uuidSchema,
  stemId: uuidSchema,
  version: z.number().int().positive(),
  creatorId: uuidSchema,
  parentStemVersionId: uuidSchema.nullable(),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
});

export type MidiNoteV1 = z.infer<typeof midiNoteV1Schema>;
export type MidiStemContentV1 = z.infer<typeof stemContentSchema>;
export type MidiStemDraftV1 = z.infer<typeof midiStemDraftV1Schema>;
export type MidiStemVersionV1 = z.infer<typeof midiStemVersionV1Schema>;

export const midiClipReferenceV1Schema = z
  .object({
    clipId: uuidSchema,
    midiStemVersionId: uuidSchema,
    startTick: tickSchema,
    durationTicks: positiveTickSchema,
    sourceStartTick: tickSchema,
    loop: z.boolean(),
  })
  .strict();

const commonTrackSchema = {
  trackId: uuidSchema,
  name: z.string().trim().min(1).max(120),
  instrumentId: uuidSchema.nullable(),
  ...mixerSchema,
} as const;

export const midiTrackV2Schema = z
  .object({
    kind: z.literal("midi"),
    ...commonTrackSchema,
    presetId: z.string().trim().min(1).max(64),
    presetVersion: z.number().int().positive(),
    clips: z.array(midiClipReferenceV1Schema).min(1).max(MAX_CLIPS_PER_TRACK),
  })
  .strict();

export const workspaceTrackV2Schema = midiTrackV2Schema;

export const workspaceManifestV2Schema = z
  .object({
    manifestVersion: z.literal(2),
    engine: z.literal("jam-session-composite"),
    engineVersion: z.literal(COMPOSITE_STUDIO_ENGINE_VERSION),
    projectId: uuidSchema,
    tempoBpm: z.number().finite().min(20).max(400),
    timeSignature: z
      .object({
        numerator: z.number().int().min(1).max(32),
        denominator: z.union([
          z.literal(1),
          z.literal(2),
          z.literal(4),
          z.literal(8),
          z.literal(16),
          z.literal(32),
        ]),
      })
      .strict(),
    durationTicks: positiveTickSchema,
    tracks: z.array(workspaceTrackV2Schema).max(MAX_MIDI_TRACKS),
  })
  .strict()
  .superRefine(({ durationTicks, tempoBpm, tracks }, context) => {
    const maximumDurationTicks = Math.floor(
      MAX_PROJECT_MINUTES * 60 * tempoBpm * MIDI_PPQ,
    );
    if (durationTicks > maximumDurationTicks) {
      context.addIssue({
        code: "custom",
        message: "Project exceeds the ten-minute duration limit",
        path: ["durationTicks"],
      });
    }

    if (tracks.length > MAX_MIDI_TRACKS) {
      context.addIssue({
        code: "custom",
        message: "Too many MIDI tracks",
        path: ["tracks"],
      });
    }
    if (tracks.length > 0 && tempoBpm > 300) {
      context.addIssue({
        code: "custom",
        message: "MIDI projects cannot exceed 300 BPM",
        path: ["tempoBpm"],
      });
    }

    for (const key of ["trackId", "sortOrder"] as const) {
      const seen = new Set<string | number>();
      tracks.forEach((track, index) => {
        if (seen.has(track[key])) {
          context.addIssue({
            code: "custom",
            message: `Duplicate ${key}`,
            path: ["tracks", index, key],
          });
        }
        seen.add(track[key]);
      });
    }
    const clipIds = new Set<string>();
    tracks.forEach((track, trackIndex) => {
      track.clips.forEach((clip, clipIndex) => {
        if (clipIds.has(clip.clipId)) {
          context.addIssue({
            code: "custom",
            message: "Duplicate clipId",
            path: ["tracks", trackIndex, "clips", clipIndex, "clipId"],
          });
        }
        clipIds.add(clip.clipId);
        const clipEnd = clip.startTick + clip.durationTicks;
        if (clipEnd > durationTicks) {
          context.addIssue({
            code: "custom",
            message: "Clip exceeds project duration",
            path: ["tracks", trackIndex, "clips", clipIndex],
          });
        }
      });
    });
    const orders = tracks
      .map(({ sortOrder }) => sortOrder)
      .sort((a, b) => a - b);
    if (orders.some((order, index) => order !== index)) {
      context.addIssue({
        code: "custom",
        message: "Track sortOrder values must be contiguous",
        path: ["tracks"],
      });
    }
  });

export type MidiClipReferenceV1 = z.infer<typeof midiClipReferenceV1Schema>;
export type MidiTrackV2 = z.infer<typeof midiTrackV2Schema>;
export type WorkspaceTrackV2 = z.infer<typeof workspaceTrackV2Schema>;
export type WorkspaceManifestV2 = z.infer<typeof workspaceManifestV2Schema>;

function compareNotes(left: MidiNoteV1, right: MidiNoteV1) {
  return (
    left.startTick - right.startTick ||
    left.pitch - right.pitch ||
    left.noteId.localeCompare(right.noteId)
  );
}

export function canonicalizeMidiNotes(notes: readonly MidiNoteV1[]) {
  return [...notes].sort(compareNotes);
}

export function canonicalizeStemContent<
  T extends MidiStemDraftV1 | MidiStemVersionV1,
>(stem: T): T {
  return { ...stem, notes: canonicalizeMidiNotes(stem.notes) };
}

export function parseMidiStemDraft(input: unknown): MidiStemDraftV1 {
  return canonicalizeStemContent(midiStemDraftV1Schema.parse(input));
}

export function parseMidiStemVersion(input: unknown): MidiStemVersionV1 {
  return canonicalizeStemContent(midiStemVersionV1Schema.parse(input));
}

export function canonicalizeManifestV2(
  manifest: WorkspaceManifestV2,
): WorkspaceManifestV2 {
  return {
    ...manifest,
    tracks: [...manifest.tracks]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((track) => ({
        ...track,
        clips: [...track.clips].sort(
          (left, right) =>
            left.startTick - right.startTick ||
            left.clipId.localeCompare(right.clipId),
        ),
      })),
  };
}

export function parseWorkspaceManifestV2(input: unknown): WorkspaceManifestV2 {
  return canonicalizeManifestV2(workspaceManifestV2Schema.parse(input));
}
