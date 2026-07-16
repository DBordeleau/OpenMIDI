import { z } from "zod";

export const reportTargetKindSchema = z.enum([
  "profile",
  "project",
  "contribution",
]);
export const reportReasonSchema = z.enum([
  "copyright",
  "harassment",
  "sexual_content",
  "hate_or_violence",
  "spam",
  "other",
]);
export const reportInputSchema = z.object({
  requestId: z.uuid(),
  targetKind: reportTargetKindSchema,
  targetId: z.uuid(),
  reason: reportReasonSchema,
  detail: z
    .string()
    .trim()
    .max(2000)
    .transform((value) => value || null),
});

export const moderationActionSchema = z.object({
  reportId: z.uuid(),
  requestId: z.uuid(),
  action: z.enum([
    "assign_self",
    "dismiss",
    "resolve",
    "hide",
    "restore",
    "suspend_account",
    "restore_account",
  ]),
  reason: z.string().trim().min(1).max(500),
  expectedReportStatus: z.enum([
    "submitted",
    "reviewing",
    "resolved",
    "dismissed",
  ]),
  expectedTargetVersion: z.coerce.number().int().positive(),
});

export const accountDeletionSchema = z.object({
  requestId: z.uuid(),
  username: z.string().min(3).max(30),
});

export const holdActionSchema = z.object({
  requestId: z.uuid(),
  operation: z.enum(["place", "release"]),
  targetKind: reportTargetKindSchema.optional(),
  targetId: z.uuid().optional(),
  holdId: z.uuid().optional(),
  holdType: z.enum(["legal", "abuse"]).optional(),
  reason: z.string().trim().min(1).max(500),
});

export const contributionDeletionSchema = z.object({
  contributionId: z.uuid(),
  requestId: z.uuid(),
});
