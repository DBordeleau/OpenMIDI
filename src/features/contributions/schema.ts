import { z } from "zod";

export const CONTRIBUTOR_ATTESTATION_VERSION =
  "contributor-attestation-v1" as const;
export const CONTRIBUTOR_ATTESTATION_TEXT =
  "I confirm that I have the rights needed to submit this material and authorize the project owner to review it and, if accepted in a later step, incorporate it under the projectâ€™s displayed license.";

export const contributionStatusSchema = z.enum([
  "draft",
  "submitted",
  "changes_requested",
  "accepted",
  "rejected",
  "withdrawn",
]);

export const createContributionSchema = z
  .object({
    requestId: z.uuid(),
    expectedCurrentRevisionId: z.uuid(),
    title: z.string().trim().min(1, "Enter a title.").max(120),
    description: z
      .string()
      .trim()
      .max(5000)
      .transform((value) => value || null),
  })
  .strict();

export const submitContributionSchema = z
  .object({
    contributionId: z.uuid(),
    requestId: z.uuid(),
    expectedWorkspaceLockVersion: z.number().int().positive(),
    expectedBaseRevisionId: z.uuid(),
    expectedManifestSha256: z.string().regex(/^[0-9a-f]{64}$/),
    attestationVersion: z.literal(CONTRIBUTOR_ATTESTATION_VERSION),
    attested: z.literal(true),
  })
  .strict();

export const withdrawContributionSchema = z
  .object({
    contributionId: z.uuid(),
    expectedStatus: contributionStatusSchema,
    expectedCurrentVersionId: z.uuid().nullable(),
  })
  .strict();

export const contributionIdSchema = z.uuid();
