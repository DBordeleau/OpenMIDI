"use server";

import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/supabase/database.types";
import {
  createChallengeDraft,
  mutateChallengeLifecycle,
  reviseChallengeDraft,
} from "@/server/repositories/challenges";
import type { ChallengeFormActionState } from "./action-state";
import { canonicalizeChallengeConstraintsV1 } from "./constraint-v1";
import {
  challengeLifecycleActionSchema,
  challengeVersionInputSchema,
  reviseChallengeInputSchema,
} from "./schema";

export async function saveChallengeDraftAction(
  _state: ChallengeFormActionState,
  formData: FormData,
): Promise<ChallengeFormActionState> {
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return invalidState();
  }
  const mode = formData.get("mode");
  const parsed =
    mode === "revise"
      ? reviseChallengeInputSchema.safeParse(payload)
      : challengeVersionInputSchema.safeParse(payload);
  if (!parsed.success) return invalidState(parsed.error.issues[0]?.message);

  const value = parsed.data;
  const version = {
    title: value.title,
    prompt: value.prompt,
    description: value.description,
    eligibilityTerms: value.eligibilityTerms,
    presentationCode: value.presentationCode,
    opensAt: value.opensAt,
    submissionsCloseAt: value.submissionsCloseAt,
    votingOpensAt: value.votingOpensAt,
    votingClosesAt: value.votingClosesAt,
    resultsExpectedAt: value.resultsExpectedAt,
    judgingMode: value.judgingMode,
    officialPlacementCount: value.officialPlacementCount,
    starterProjectId: value.starterProjectId,
    starterRevisionId: value.starterRevisionId,
    constraints: canonicalizeChallengeConstraintsV1(
      value.constraints,
    ) as unknown as Json,
  };
  const result =
    mode === "revise" && "challengeId" in value
      ? await reviseChallengeDraft({
          challengeId: value.challengeId,
          requestId: value.requestId,
          expectedLifecycleVersion: value.expectedLifecycleVersion,
          expectedCurrentVersionId: value.expectedCurrentVersionId,
          version,
          judges: value.judges,
        })
      : await createChallengeDraft({
          requestId: value.requestId,
          slug: "slug" in value ? value.slug : "",
          version,
          judges: value.judges,
        });
  if (result.error) return commandError(result.error.code);
  revalidatePath("/admin/challenges");
  revalidatePath("/challenges");
  return {
    status: "success",
    message:
      mode === "revise"
        ? "A new immutable draft version was appended."
        : "Challenge draft created.",
    challengeId: result.data?.challengeId,
    lifecycleVersion: result.data?.lifecycleVersion,
  };
}

export async function mutateChallengeLifecycleAction(
  _state: ChallengeFormActionState,
  formData: FormData,
): Promise<ChallengeFormActionState> {
  const parsed = challengeLifecycleActionSchema.safeParse({
    challengeId: formData.get("challengeId"),
    requestId: formData.get("requestId"),
    expectedLifecycleVersion: formData.get("expectedLifecycleVersion"),
    expectedCurrentVersionId: formData.get("expectedCurrentVersionId"),
    action: formData.get("action"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return invalidState();
  const result = await mutateChallengeLifecycle(parsed.data);
  if (result.error) return commandError(result.error.code);
  revalidatePath("/admin/challenges");
  revalidatePath(`/admin/challenges/${parsed.data.challengeId}`);
  revalidatePath("/challenges");
  return {
    status: "success",
    message:
      parsed.data.action === "publish"
        ? "Challenge published into its time-derived lifecycle."
        : "Challenge cancelled and the audit record was saved.",
    challengeId: parsed.data.challengeId,
    lifecycleVersion: result.data?.lifecycleVersion,
  };
}

function invalidState(detail?: string): ChallengeFormActionState {
  return {
    status: "error",
    message: detail ?? "Check the highlighted challenge fields and schedule.",
  };
}

function commandError(code?: string): ChallengeFormActionState {
  const message =
    code === "PT409"
      ? "This challenge changed or the request conflicts. Reload before trying again."
      : code === "PT403"
        ? "Only an active administrator can perform this challenge action."
        : code === "PT404"
          ? "The selected challenge, profile, or starter is no longer available."
          : "The challenge action could not be saved.";
  return { status: "error", message };
}
