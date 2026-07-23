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

const staleDraftResolutionAuthoritySchema = z
  .object({
    workspaceId: z.uuid(),
    requestId: z.uuid(),
    expectedWorkspaceLockVersion: z.number().int().positive(),
    expectedBaseRevisionId: z.uuid(),
    expectedCurrentRevisionId: z.uuid(),
  })
  .strict();

export const staleDraftForkTitleSchema = z.string().trim().min(1).max(120);

export const resolveStaleOwnerWorkspaceSchema = z.discriminatedUnion(
  "resolution",
  [
    staleDraftResolutionAuthoritySchema.extend({
      resolution: z.literal("restart_latest"),
      forkTitle: z.null(),
    }),
    staleDraftResolutionAuthoritySchema.extend({
      resolution: z.literal("preserve_as_fork"),
      forkTitle: staleDraftForkTitleSchema,
    }),
  ],
);

export const staleOwnerWorkspaceResolutionRowSchema = z
  .object({
    resolution: z.enum(["restart_latest", "preserve_as_fork"]),
    source_project_id: z.uuid(),
    source_workspace_id: z.uuid(),
    target_project_id: z.uuid(),
    target_workspace_id: z.uuid(),
    target_base_revision_id: z.uuid(),
    target_workspace_lock_version: z.number().int().positive(),
    created_at: z.iso.datetime({ offset: true }),
  })
  .strict();

export type ResolveStaleOwnerWorkspaceInput = z.infer<
  typeof resolveStaleOwnerWorkspaceSchema
>;
export type StaleOwnerWorkspaceResolutionRow = z.infer<
  typeof staleOwnerWorkspaceResolutionRowSchema
>;

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
