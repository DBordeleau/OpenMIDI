import { z } from "zod";
export const publishSelectionSchema = z
  .object({
    requestId: z.uuid(),
    tracks: z
      .array(
        z
          .object({
            trackId: z.uuid(),
            assetId: z.uuid(),
            name: z.string().trim().min(1).max(120),
            instrumentId: z.uuid().nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(12),
    message: z.string().trim().max(500),
  })
  .strict()
  .superRefine(({ tracks }, context) => {
    if (new Set(tracks.map(({ assetId }) => assetId)).size !== tracks.length)
      context.addIssue({
        code: "custom",
        message: "Choose each stem only once.",
        path: ["tracks"],
      });
    if (new Set(tracks.map(({ trackId }) => trackId)).size !== tracks.length)
      context.addIssue({
        code: "custom",
        message: "Track identifiers must be unique.",
        path: ["tracks"],
      });
  });
