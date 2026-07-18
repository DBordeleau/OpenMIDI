"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ChallengeEntryActionState } from "./entry-action-state";
import {
  preflightChallengeRevision,
  submitChallengeEntry,
} from "@/server/repositories/challenges";

const preflightInputSchema = z.object({
  challengeId: z.uuid(),
  challengeVersionId: z.uuid(),
  revisionId: z.uuid(),
});

const submitInputSchema = preflightInputSchema.extend({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  requestId: z.uuid(),
  expectedActiveEntryId: z.uuid().nullable(),
  displayAttestationVersion: z.literal("challenge-display-attestation-v1"),
});

export async function preflightChallengeEntryAction(
  _state: ChallengeEntryActionState,
  formData: FormData,
): Promise<ChallengeEntryActionState> {
  const parsed = preflightInputSchema.safeParse({
    challengeId: formData.get("challengeId"),
    challengeVersionId: formData.get("challengeVersionId"),
    revisionId: formData.get("revisionId"),
  });
  if (!parsed.success)
    return errorState("Choose a current project revision to check.");
  try {
    const result = await preflightChallengeRevision(parsed.data);
    if (result.error || !result.data) return commandError(result.error?.code);
    return {
      status: "success",
      message: result.data.evaluation.eligible
        ? "This exact revision passes every challenge rule."
        : "This revision is not eligible yet. Review every correction below, update the project in Studio, publish a new revision, then preflight again.",
      preflight: result.data,
    };
  } catch {
    return errorState(
      "The eligibility result was malformed or unavailable. Reload and try again.",
    );
  }
}

export async function submitChallengeEntryAction(
  _state: ChallengeEntryActionState,
  formData: FormData,
): Promise<ChallengeEntryActionState> {
  const parsed = submitInputSchema.safeParse({
    challengeId: formData.get("challengeId"),
    challengeVersionId: formData.get("challengeVersionId"),
    revisionId: formData.get("revisionId"),
    slug: formData.get("slug"),
    requestId: formData.get("requestId"),
    expectedActiveEntryId: formData.get("expectedActiveEntryId") || null,
    displayAttestationVersion: formData.get("displayAttestation"),
  });
  if (!parsed.success) {
    return errorState(
      formData.get("displayAttestation")
        ? "Reload and preflight the current revision again."
        : "Read and accept the challenge-scoped public display attestation before submitting.",
    );
  }
  try {
    const result = await submitChallengeEntry({
      challengeId: parsed.data.challengeId,
      challengeVersionId: parsed.data.challengeVersionId,
      revisionId: parsed.data.revisionId,
      requestId: parsed.data.requestId,
      expectedActiveEntryId: parsed.data.expectedActiveEntryId,
      displayAttestationVersion: parsed.data.displayAttestationVersion,
    });
    if (result.error || !result.data) return commandError(result.error?.code);
    if ("errorCode" in result.data) return commandError(result.data.errorCode);
    revalidatePath(`/challenges/${parsed.data.slug}`);
    return {
      status: "success",
      entryId: result.data.entryId,
      message: parsed.data.expectedActiveEntryId
        ? "Replacement submitted. The prior entry is closed and this exact revision is now your active entry."
        : "Entry submitted. This exact revision is pinned as your active entry.",
    };
  } catch {
    return errorState(
      "The entry response was malformed or unavailable. Reload before trying again.",
    );
  }
}

function errorState(message: string): ChallengeEntryActionState {
  return { status: "error", message };
}

function commandError(code?: string): ChallengeEntryActionState {
  const message =
    code === "PT401"
      ? "Sign in to preflight or submit a challenge entry."
      : code === "PT403"
        ? "Only an active project owner can use this challenge entry action."
        : code === "PT404"
          ? "That project revision is hidden, deleted, unauthorized, or no longer current."
          : code === "PT422"
            ? "Postgres rechecked the exact revision and found it ineligible. Preflight the current revision again."
            : code === "PT429"
              ? "Too many entry attempts. Wait before trying again."
              : code === "PT409"
                ? "The challenge, project revision, deadline, or active entry changed. Reload and preflight again."
                : "The challenge entry action could not be completed.";
  return errorState(message);
}
