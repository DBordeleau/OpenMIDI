import { z } from "zod";

export const CONTRIBUTOR_ATTESTATION_VERSION =
  "contributor-attestation-v1" as const;
export const CONTRIBUTOR_ATTESTATION_TEXT =
  "I confirm that I have the rights to submit every MIDI pattern in this arrangement and agree that accepted public reuse remains licensed under CC BY 4.0 with attribution and source lineage preserved.";
export const MIDI_PUBLIC_LICENSE_CODE = "cc-by-4.0" as const;

export const contributionStatusSchema = z.enum([
  "draft",
  "submitted",
  "changes_requested",
  "accepted",
  "rejected",
  "withdrawn",
]);

export const contributionReviewDecisionSchema = z.enum([
  "request_changes",
  "reject",
  "accept",
]);

export const createContributionSchema = z
  .object({
    requestId: z.uuid(),
    expectedCurrentRevisionId: z.uuid(),
    expectedLicenseCode: z.literal(MIDI_PUBLIC_LICENSE_CODE),
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
    expectedLicenseCode: z.literal(MIDI_PUBLIC_LICENSE_CODE),
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

export const reviewContributionSchema = z
  .object({
    contributionId: z.uuid(),
    requestId: z.uuid(),
    decision: contributionReviewDecisionSchema,
    expectedStatus: z.literal("submitted"),
    expectedCurrentVersionId: z.uuid(),
    expectedProjectRevisionId: z.uuid(),
    note: z
      .string()
      .trim()
      .max(5000)
      .transform((value) => value || null),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.decision !== "accept" && value.note === null)
      context.addIssue({
        code: "custom",
        path: ["note"],
        message: "Add a review note.",
      });
    if (value.decision === "accept" && (value.note?.length ?? 0) > 500)
      context.addIssue({
        code: "custom",
        path: ["note"],
        message: "Acceptance notes are limited to 500 characters.",
      });
  });

export const contributionIdSchema = z.uuid();
export const contributionVersionIdSchema = z.uuid();
