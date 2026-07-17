import { z } from "zod";
import { workspaceManifestV2Schema } from "@/features/studio/manifest/v2";
import { workspaceManifestV3Schema } from "@/features/studio/manifest/v3";

export const createWorkspaceSchema = z.object({
  requestId: z.uuid(),
  expectedCurrentRevisionId: z.uuid(),
});

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
