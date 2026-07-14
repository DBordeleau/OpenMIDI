import { z } from "zod";
import {
  MAX_MIDI_STEM_DURATION_TICKS,
  MAX_MIDI_NOTES_PER_STEM,
  MIDI_PPQ,
  midiNoteV1Schema,
} from "@/features/studio/manifest/v2";
import { resolveSynthPreset } from "../presets";

export const midiStemEntryModeSchema = z.enum(["blank", "import", "derive"]);

export const createMidiStemDraftSchema = z
  .object({
    requestId: z.uuid(),
    name: z.string().trim().min(1).max(120),
    entryMode: midiStemEntryModeSchema,
    parentStemVersionId: z.uuid().nullable(),
  })
  .strict()
  .refine(
    ({ entryMode, parentStemVersionId }) =>
      (entryMode === "derive") === Boolean(parentStemVersionId),
    { message: "A derived draft requires one exact parent version." },
  );

export const midiStemContentSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    defaultPresetId: z.string().trim().min(1).max(64),
    defaultPresetVersion: z.number().int().positive(),
    ppq: z.literal(MIDI_PPQ),
    durationTicks: z
      .number()
      .int()
      .positive()
      .max(MAX_MIDI_STEM_DURATION_TICKS),
    notes: z.array(midiNoteV1Schema).max(MAX_MIDI_NOTES_PER_STEM),
  })
  .strict()
  .superRefine((content, context) => {
    const ids = new Set<string>();
    let preset;
    try {
      preset = resolveSynthPreset(
        content.defaultPresetId,
        content.defaultPresetVersion,
      );
    } catch {
      context.addIssue({
        code: "custom",
        message: "Choose a supported sound.",
        path: ["defaultPresetId"],
      });
      return;
    }
    content.notes.forEach((note, index) => {
      if (ids.has(note.noteId)) {
        context.addIssue({
          code: "custom",
          message: "Every note needs a unique identity.",
          path: ["notes", index, "noteId"],
        });
      }
      ids.add(note.noteId);
      if (note.startTick + note.durationTicks > content.durationTicks) {
        context.addIssue({
          code: "custom",
          message: "Note exceeds the stem duration.",
          path: ["notes", index],
        });
      }
      if (note.pitch < preset.minNote || note.pitch > preset.maxNote) {
        context.addIssue({
          code: "custom",
          message: "Note is outside this sound's supported range.",
          path: ["notes", index, "pitch"],
        });
      }
    });
  });

export const saveMidiStemDraftSchema = z
  .object({
    draftId: z.uuid(),
    requestId: z.uuid(),
    expectedLockVersion: z.number().int().positive(),
    content: midiStemContentSchema,
  })
  .strict();

export type MidiStemEntryMode = z.infer<typeof midiStemEntryModeSchema>;
export type MidiStemContent = z.infer<typeof midiStemContentSchema>;
