import { z } from "zod";

export const audioSourcesRequestSchema = z
  .object({
    assetIds: z
      .array(z.uuid())
      .min(1)
      .max(12)
      .refine((ids) => new Set(ids).size === ids.length, "Duplicate asset IDs"),
  })
  .strict();

export const workspaceAudioSourcesRequestSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("load"),
      assetIds: z
        .array(z.uuid())
        .min(1)
        .max(12)
        .refine(
          (ids) => new Set(ids).size === ids.length,
          "Duplicate asset IDs",
        ),
    })
    .strict(),
  z.object({ mode: z.literal("add"), assetId: z.uuid() }).strict(),
]);

export type SignedAudioSource = {
  assetId: string;
  signedUrl: string;
  expiresAt: string;
  mediaType: string | null;
  durationMs: number;
  sampleRateHz: number;
  channels: number;
  peaks: {
    signedUrl: string;
    expiresAt: string;
    sha256: string;
    formatVersion: number;
    algorithmVersion: string;
    channels: number;
    durationMs: number;
    sampleRateHz: number;
    binCount: number;
  } | null;
};
