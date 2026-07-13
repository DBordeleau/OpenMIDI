import { z } from "zod";
import { workspaceManifestV1Schema } from "@/features/studio/manifest/schema";

export const createWorkspaceSchema = z.object({
  requestId: z.uuid(),
  expectedCurrentRevisionId: z.uuid(),
});

export const reserveWorkspaceSnapshotSchema = z.object({
  workspaceId: z.uuid(),
  requestId: z.uuid(),
  expectedLockVersion: z.number().int().positive(),
  manifestSha256: z.string().regex(/^[0-9a-f]{64}$/),
  byteSize: z.number().int().min(1).max(65_536),
});

export const saveWorkspaceSchema = z.object({
  workspaceId: z.uuid(),
  requestId: z.uuid(),
  expectedLockVersion: z.number().int().positive(),
  snapshotAssetId: z.uuid(),
  manifest: workspaceManifestV1Schema,
});

export const publishWorkspaceSchema = z
  .object({
    workspaceId: z.uuid(),
    requestId: z.uuid(),
    expectedLockVersion: z.number().int().positive(),
    expectedBaseRevisionId: z.uuid(),
    message: z.string().trim().max(500).nullable(),
  })
  .strict();

export const restartWorkspaceSchema = z
  .object({
    workspaceId: z.uuid(),
    requestId: z.uuid(),
    expectedLockVersion: z.number().int().positive(),
    expectedBaseRevisionId: z.uuid(),
    expectedCurrentRevisionId: z.uuid(),
  })
  .strict();

export const localRecoveryEnvelopeSchema = z
  .object({
    version: z.literal(1),
    viewerId: z.uuid(),
    projectId: z.uuid(),
    workspaceId: z.uuid(),
    baseRevisionId: z.uuid(),
    serverLockVersion: z.number().int().positive(),
    manifest: workspaceManifestV1Schema,
    manifestSha256: z.string().regex(/^[0-9a-f]{64}$/),
    savedAt: z.string().datetime(),
    state: z.enum(["pending", "conflict"]),
  })
  .strict();

export type LocalRecoveryEnvelope = z.infer<typeof localRecoveryEnvelopeSchema>;
