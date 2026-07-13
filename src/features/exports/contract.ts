import { z } from "zod";

export const stemExportRequestSchema = z
  .object({
    assetIds: z
      .array(z.uuid())
      .min(1)
      .max(12)
      .refine((ids) => new Set(ids).size === ids.length),
  })
  .strict();

export type StemExportFile = {
  assetId: string;
  filename: string;
  mediaType: string;
  byteSize: number;
  sha256: string;
  creditName: string;
  signedUrl: string;
  expiresAt: string;
};

export type StemExportResponse = {
  version: 1;
  projectId: string;
  projectTitle: string;
  revisionId: string | null;
  revisionNumber: number | null;
  workspaceId: string | null;
  files: StemExportFile[];
};
