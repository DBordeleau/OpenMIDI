import { z } from "zod";

export const quickPreviewResponseSchema = z.object({
  projectId: z.string().uuid(),
  revisionId: z.string().uuid(),
  durationMs: z.number().int().positive(),
  tracks: z
    .array(
      z.object({
        trackId: z.string().uuid(),
        signedUrl: z.string().url(),
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

export type QuickPreviewResponse = z.infer<typeof quickPreviewResponseSchema>;
