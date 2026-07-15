import { z } from "zod";
import {
  midiStemVersionV1Schema,
  workspaceManifestV2Schema,
} from "./manifest/v2";

const base = {
  projectId: z.uuid(),
  revisionId: z.uuid(),
  durationMs: z.number().int().positive(),
};

const audioPreviewSchema = z.object({
  ...base,
  kind: z.literal("audio"),
  tracks: z
    .array(
      z.object({
        trackId: z.uuid(),
        signedUrl: z.url(),
        positionMs: z.number().int().nonnegative(),
        trimStartMs: z.number().int().nonnegative(),
        durationMs: z.number().int().positive(),
        gainDb: z.number().min(-60).max(6),
        pan: z.number().min(-1).max(1),
        muted: z.boolean(),
        soloed: z.boolean(),
      }),
    )
    .min(1)
    .max(12),
});

const midiPreviewSchema = z.object({
  ...base,
  kind: z.literal("midi"),
  manifest: workspaceManifestV2Schema,
  stems: z.array(midiStemVersionV1Schema).max(16),
  audioSources: z
    .array(z.object({ assetId: z.uuid(), signedUrl: z.url() }))
    .max(12)
    .default([]),
});

export const quickPreviewResponseSchema = z.discriminatedUnion("kind", [
  audioPreviewSchema,
  midiPreviewSchema,
]);
export type QuickPreviewResponse = z.infer<typeof quickPreviewResponseSchema>;
export type AudioQuickPreviewResponse = z.infer<typeof audioPreviewSchema>;
