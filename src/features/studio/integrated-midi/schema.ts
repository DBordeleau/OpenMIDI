import { z } from "zod";
import { patternContentV3Schema } from "@/features/midi/domain-v3";

export const createIntegratedMidiDraftSchema = z
  .object({
    requestId: z.uuid(),
    name: z.string().trim().min(1).max(120),
    parentStemVersionId: z.uuid().nullable(),
  })
  .strict();

export const finalizeIntegratedMidiDraftSchema = z
  .object({
    projectId: z.uuid(),
    draftId: z.uuid(),
    requestId: z.uuid(),
    expectedDraftLockVersion: z.number().int().positive(),
    expectedContentSha256: z.string().regex(/^[0-9a-f]{64}$/),
    workspaceId: z.uuid(),
    expectedWorkspaceLockVersion: z.number().int().positive(),
    operation: z.enum(["add", "replace"]),
    trackId: z.uuid(),
    clipId: z.uuid(),
    startTick: z.number().int().nonnegative().nullable(),
  })
  .strict()
  .refine(
    ({ operation, startTick }) =>
      operation === "add" ? startTick !== null : startTick === null,
    { message: "Only a new clip requires an arrangement start." },
  );

export const freezeStudioPatternSchema = z
  .object({
    patternRequestId: z.uuid(),
    versionRequestId: z.uuid(),
    name: z.string().trim().min(1).max(120),
    existingPatternId: z.uuid().nullable(),
    expectedVersionNumber: z.number().int().positive(),
    sourcePatternVersionId: z.uuid().nullable(),
    content: patternContentV3Schema,
  })
  .strict()
  .refine(
    ({ existingPatternId, expectedVersionNumber, sourcePatternVersionId }) =>
      existingPatternId
        ? expectedVersionNumber > 1 && sourcePatternVersionId === null
        : expectedVersionNumber === 1,
    { message: "Pattern lineage input is inconsistent." },
  );
