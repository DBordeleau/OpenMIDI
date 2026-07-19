import { z } from "zod";
import { midiPatternVersionV3Schema } from "@/features/midi/domain-v3";
import { arrangementManifestV3Schema } from "@/features/studio/manifest/v3";

export const midiArrangementPreviewSchema = z
  .object({
    projectId: z.uuid(),
    revisionId: z.uuid(),
    revisionNumber: z.number().int().positive(),
    projectTitle: z.string().trim().min(1).max(120),
    manifest: arrangementManifestV3Schema,
    patternVersions: z.array(midiPatternVersionV3Schema).max(512),
    attributions: z
      .array(
        z
          .object({
            kind: z.enum(["publisher", "accepted_contributor"]),
            creditName: z.string().trim().min(1).max(120),
          })
          .strict(),
      )
      .max(2),
  })
  .strict();

export const publicMidiRevisionSchema = midiArrangementPreviewSchema
  .safeExtend({
    license: z
      .object({
        code: z.string().trim().min(1).max(40),
        name: z.string().trim().min(1).max(100),
        url: z.url(),
      })
      .strict(),
  })
  .strict();

export const publicMidiPreviewResponseSchema = z.union([
  publicMidiRevisionSchema,
  midiArrangementPreviewSchema,
]);

export type PublicMidiRevision = z.infer<typeof publicMidiRevisionSchema>;
export type MidiArrangementPreview = z.infer<
  typeof midiArrangementPreviewSchema
>;
