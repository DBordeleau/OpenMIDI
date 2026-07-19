import { z } from "zod";
import {
  challengeEvaluationV1Schema,
  challengeFactsV1Schema,
} from "./evaluate-constraint-v1";

export const challengeRevisionOptionSchema = z
  .object({
    projectId: z.uuid(),
    projectTitle: z.string().trim().min(1).max(120),
    revisionId: z.uuid(),
    revisionNumber: z.number().int().positive(),
    revisionMessage: z.string().trim().min(1).max(500).nullable(),
    durationMs: z.number().int().nonnegative(),
    visibility: z.enum(["private", "public"]),
  })
  .strict();

export const challengePreflightSchema = z
  .object({
    challengeId: z.uuid(),
    challengeVersionId: z.uuid(),
    projectId: z.uuid(),
    projectTitle: z.string().trim().min(1).max(120),
    revisionId: z.uuid(),
    revisionNumber: z.number().int().positive(),
    revisionMessage: z.string().trim().min(1).max(500).nullable(),
    facts: challengeFactsV1Schema,
    evaluation: challengeEvaluationV1Schema,
  })
  .strict();

export const challengeEntryCommandResultSchema = z
  .object({
    entryId: z.uuid(),
    challengeId: z.uuid(),
    challengeVersionId: z.uuid(),
    projectId: z.uuid(),
    revisionId: z.uuid(),
    status: z.literal("active"),
    submittedAt: z.string(),
    replacedEntryId: z.uuid().nullable(),
  })
  .strict();

export const challengeEntryCommandResponseSchema = z.union([
  challengeEntryCommandResultSchema,
  z.object({ errorCode: z.string().regex(/^PT[0-9]{3}$/) }).strict(),
]);

export const myChallengeEntrySchema = z
  .object({
    entryId: z.uuid(),
    challengeId: z.uuid(),
    challengeVersionId: z.uuid(),
    projectId: z.uuid(),
    projectTitle: z.string().trim().min(1).max(120),
    revisionId: z.uuid(),
    revisionNumber: z.number().int().positive(),
    revisionMessage: z.string().trim().min(1).max(500).nullable(),
    status: z.enum(["active", "replaced", "withdrawn", "disqualified"]),
    submittedAt: z.string(),
    displayAttestedAt: z.string(),
    facts: challengeFactsV1Schema,
    evaluation: challengeEvaluationV1Schema,
    replacementOfEntryId: z.uuid().nullable(),
  })
  .strict();

const attributionSchema = z
  .object({
    kind: z.enum(["publisher", "accepted_contributor"]),
    creditName: z.string().trim().min(1).max(120),
  })
  .strict();

export const publicChallengeEntrySchema = z
  .object({
    entryId: z.uuid(),
    challengeId: z.uuid(),
    challengeVersionId: z.uuid(),
    projectTitle: z.string().trim().min(1).max(120),
    entrantUsername: z.string().trim().min(3).max(30),
    entrantDisplayName: z.string().trim().min(1).max(80),
    entrantCreditName: z.string().trim().min(1).max(120),
    revisionNumber: z.number().int().positive(),
    revisionMessage: z.string().trim().min(1).max(500).nullable(),
    attributions: z.array(attributionSchema).min(1).max(2),
    durationMs: z.number().int().nonnegative(),
    submittedAt: z.string(),
    voteTotal: z.number().int().nonnegative().nullable(),
    rotationKey: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
  })
  .strict();

export const publicChallengeEntryPageSchema = z
  .object({
    rotationBucket: z.string(),
    entries: z.array(publicChallengeEntrySchema),
    nextCursor: z
      .object({
        rotationKey: z.string().regex(/^[0-9a-f]{64}$/),
        entryId: z.uuid(),
      })
      .strict()
      .nullable(),
  })
  .strict();

export const publicChallengeEntryCursorSchema = z
  .object({
    rotationBucket: z.iso.datetime(),
    rotationKey: z.string().regex(/^[0-9a-f]{64}$/),
    entryId: z.uuid(),
  })
  .strict();

export const publicChallengeAwardTargetQuerySchema = z
  .object({
    result: z.uuid(),
    entry: z.uuid(),
  })
  .strict();

export const publicChallengeAwardTargetSchema = publicChallengeEntrySchema
  .omit({ rotationKey: true })
  .extend({
    resultId: z.uuid(),
    resultVersion: z.number().int().positive(),
    resultFinalizedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type ChallengeRevisionOption = z.infer<
  typeof challengeRevisionOptionSchema
>;
export type ChallengePreflight = z.infer<typeof challengePreflightSchema>;
export type MyChallengeEntry = z.infer<typeof myChallengeEntrySchema>;
export type PublicChallengeEntry = z.infer<typeof publicChallengeEntrySchema>;
export type PublicChallengeEntryCursor = z.infer<
  typeof publicChallengeEntryCursorSchema
>;
export type PublicChallengeAwardTarget = z.infer<
  typeof publicChallengeAwardTargetSchema
>;
