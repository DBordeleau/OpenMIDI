import { z } from "zod";
import { challengeConstraintsV1Schema } from "./constraint-v1";

const judgeSchema = z
  .object({
    role: z.enum(["host", "judge"]),
    displayName: z.string().trim().min(1).max(120),
    profileId: z.uuid().nullable(),
  })
  .strict();

const challengeVersionShape = {
  requestId: z.uuid(),
  title: z.string().trim().min(1).max(120),
  prompt: z.string().trim().min(1).max(500),
  description: z.string().trim().min(1).max(5000),
  eligibilityTerms: z.string().trim().min(1).max(2000),
  presentationCode: z.enum(["pulse", "nocturne", "sunrise"]),
  opensAt: z.iso.datetime(),
  submissionsCloseAt: z.iso.datetime(),
  votingOpensAt: z.iso.datetime(),
  votingClosesAt: z.iso.datetime(),
  resultsExpectedAt: z.iso.datetime(),
  judgingMode: z.enum(["community", "judged", "hybrid"]),
  officialPlacementCount: z.number().int().min(0).max(20),
  starterProjectId: z.uuid().nullable(),
  starterRevisionId: z.uuid().nullable(),
  constraints: challengeConstraintsV1Schema,
  judges: z.array(judgeSchema).min(1).max(10),
};

function refineChallengeVersion(
  input: z.infer<z.ZodObject<typeof challengeVersionShape>>,
  context: z.RefinementCtx,
) {
  const times = [
    input.opensAt,
    input.submissionsCloseAt,
    input.votingOpensAt,
    input.votingClosesAt,
    input.resultsExpectedAt,
  ].map((value) => new Date(value).getTime());
  if (!times.every((value, index) => index === 0 || value > times[index - 1]!))
    context.addIssue({
      code: "custom",
      path: ["opensAt"],
      message: "Schedule times must be strictly increasing.",
    });
  if ((input.starterProjectId === null) !== (input.starterRevisionId === null))
    context.addIssue({
      code: "custom",
      path: ["starterProjectId"],
      message: "Select one exact starter revision.",
    });
  if (!input.judges.some((credit) => credit.role === "host"))
    context.addIssue({
      code: "custom",
      path: ["judges"],
      message: "Add at least one host credit.",
    });
}

export const challengeVersionInputSchema = z
  .object({
    ...challengeVersionShape,
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .min(3)
      .max(80),
  })
  .strict()
  .superRefine(refineChallengeVersion);

export const reviseChallengeInputSchema = z
  .object({
    ...challengeVersionShape,
    challengeId: z.uuid(),
    expectedLifecycleVersion: z.number().int().positive(),
    expectedCurrentVersionId: z.uuid(),
  })
  .strict()
  .superRefine(refineChallengeVersion);

export const challengeLifecycleActionSchema = z.object({
  challengeId: z.uuid(),
  requestId: z.uuid(),
  expectedLifecycleVersion: z.coerce.number().int().positive(),
  expectedCurrentVersionId: z.uuid(),
  action: z.enum(["publish", "cancel"]),
  reason: z.string().trim().max(500).default(""),
});
