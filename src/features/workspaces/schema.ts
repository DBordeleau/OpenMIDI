import { z } from "zod";
import { workspaceManifestV1Schema } from "@/features/studio/manifest/schema";
import { workspaceManifestV2Schema } from "@/features/studio/manifest/v2";
import { workspaceManifestV3Schema } from "@/features/studio/manifest/v3";

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

export const saveMidiWorkspaceSchema = z
  .object({
    workspaceId: z.uuid(),
    requestId: z.uuid(),
    expectedLockVersion: z.number().int().positive(),
    manifest: workspaceManifestV2Schema,
  })
  .strict();

export const saveMidiWorkspaceV3Schema = z
  .object({
    workspaceId: z.uuid(),
    requestId: z.uuid(),
    expectedLockVersion: z.number().int().positive(),
    manifest: workspaceManifestV3Schema,
  })
  .strict();

export const publishWorkspaceSchema = z
  .object({
    workspaceId: z.uuid(),
    requestId: z.uuid(),
    expectedLockVersion: z.number().int().positive(),
    expectedBaseRevisionId: z.uuid().nullable(),
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

export const midiLocalRecoveryEnvelopeSchema = z
  .object({
    version: z.literal(2),
    viewerId: z.uuid(),
    projectId: z.uuid(),
    workspaceId: z.uuid(),
    baseRevisionId: z.uuid().nullable(),
    serverLockVersion: z.number().int().positive(),
    manifest: workspaceManifestV2Schema,
    manifestSha256: z.string().regex(/^[0-9a-f]{64}$/),
    savedAt: z.string().datetime(),
    state: z.enum(["pending", "conflict"]),
  })
  .strict();

export type MidiLocalRecoveryEnvelope = z.infer<
  typeof midiLocalRecoveryEnvelopeSchema
>;
