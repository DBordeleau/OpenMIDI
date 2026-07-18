"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  finalizeChallengeResult,
  moderateChallengeTarget,
  setFeaturedChallenge,
} from "@/server/repositories/challenges";
import type { AdminResultsActionState } from "./admin-results-action-state";

const moderationSchema = z.object({
  requestId: z.uuid(),
  challengeId: z.uuid(),
  slug: z.string(),
  entryId: z.uuid().nullable(),
  voteId: z.uuid().nullable(),
  action: z.enum([
    "challenge_hide",
    "challenge_restore",
    "entry_hide",
    "entry_restore",
    "entry_disqualify",
    "vote_exclude",
    "vote_restore",
  ]),
  expectedVersion: z.coerce.number().int().positive(),
  reason: z.string().trim().min(1).max(500),
});

const placementSchema = z.object({
  entryId: z.uuid(),
  place: z.number().int().positive().max(20),
  label: z.string().trim().min(1).max(80),
});

const resultSchema = z.object({
  requestId: z.uuid(),
  challengeId: z.uuid(),
  slug: z.string(),
  expectedLifecycleVersion: z.coerce.number().int().positive(),
  expectedCurrentVersionId: z.uuid(),
  expectedCurrentResultId: z.uuid().nullable(),
  publicNote: z.string().trim().min(1).max(2000),
  correctionReason: z.string().trim().max(500).nullable(),
  placements: z.array(placementSchema).max(20),
});

export async function moderateChallengeTargetAction(
  _state: AdminResultsActionState,
  formData: FormData,
): Promise<AdminResultsActionState> {
  const parsed = moderationSchema.safeParse({
    requestId: formData.get("requestId"),
    challengeId: formData.get("challengeId"),
    slug: formData.get("slug"),
    entryId: String(formData.get("entryId") ?? "") || null,
    voteId: String(formData.get("voteId") ?? "") || null,
    action: formData.get("action"),
    expectedVersion: formData.get("expectedVersion"),
    reason: formData.get("reason"),
  });
  if (!parsed.success)
    return { status: "error", message: "Add a bounded moderation reason." };
  const result = await moderateChallengeTarget(parsed.data);
  if (result.error)
    return {
      status: "error",
      message:
        result.error.code === "PT409"
          ? "Moderation authority changed. Reload before trying again."
          : "This moderation command was rejected.",
    };
  revalidate(parsed.data.challengeId, parsed.data.slug);
  return {
    status: "success",
    message:
      "Moderation state changed and an immutable audit row was recorded.",
  };
}

export async function finalizeChallengeResultAction(
  _state: AdminResultsActionState,
  formData: FormData,
): Promise<AdminResultsActionState> {
  let placements: unknown;
  try {
    placements = JSON.parse(String(formData.get("placements") ?? "[]"));
  } catch {
    return { status: "error", message: "Official placements are malformed." };
  }
  const correction = String(formData.get("correctionReason") ?? "").trim();
  const currentResult = String(formData.get("expectedCurrentResultId") ?? "");
  const parsed = resultSchema.safeParse({
    requestId: formData.get("requestId"),
    challengeId: formData.get("challengeId"),
    slug: formData.get("slug"),
    expectedLifecycleVersion: formData.get("expectedLifecycleVersion"),
    expectedCurrentVersionId: formData.get("expectedCurrentVersionId"),
    expectedCurrentResultId: currentResult || null,
    publicNote: formData.get("publicNote"),
    correctionReason: correction || null,
    placements,
  });
  if (!parsed.success)
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Review the complete result.",
    };
  const result = await finalizeChallengeResult(parsed.data);
  if (result.error)
    return {
      status: "error",
      message:
        result.error.code === "PT409"
          ? "Voting is still open or result authority changed. Reload before finalizing."
          : result.error.code === "PT422"
            ? "Placements must be complete, distinct, and use active visible entries."
            : "The result could not be finalized.",
    };
  revalidate(parsed.data.challengeId, parsed.data.slug);
  return {
    status: "success",
    message: currentResult
      ? "A complete superseding result version was appended. Earlier results remain immutable."
      : "Results finalized from eligible votes. Every Community Favorite tie was recorded.",
  };
}

const featureSchema = z.object({
  requestId: z.uuid(),
  challengeId: z.uuid().nullable(),
  currentChallengeId: z.uuid(),
  slug: z.string(),
  expectedVersion: z.coerce.number().int().nonnegative(),
});

export async function setFeaturedChallengeAction(
  _state: AdminResultsActionState,
  formData: FormData,
): Promise<AdminResultsActionState> {
  const selected = String(formData.get("challengeId") ?? "");
  const parsed = featureSchema.safeParse({
    requestId: formData.get("requestId"),
    challengeId: selected || null,
    currentChallengeId: formData.get("currentChallengeId"),
    slug: formData.get("slug"),
    expectedVersion: formData.get("expectedVersion"),
  });
  if (!parsed.success)
    return {
      status: "error",
      message: "Reload the featured challenge authority.",
    };
  const result = await setFeaturedChallenge(parsed.data);
  if (result.error)
    return {
      status: "error",
      message: "The featured selection changed. Reload and try again.",
    };
  revalidate(parsed.data.currentChallengeId, parsed.data.slug);
  return {
    status: "success",
    message: selected
      ? "This challenge is now the canonical featured selection."
      : "Explicit selection cleared; deterministic fallback is active.",
  };
}

function revalidate(challengeId: string, slug: string) {
  revalidatePath(`/admin/challenges/${challengeId}`);
  revalidatePath(`/admin/challenges/${challengeId}/results`);
  revalidatePath(`/challenges/${slug}`);
  revalidatePath("/challenges");
  revalidatePath("/dashboard");
  revalidatePath("/");
}
