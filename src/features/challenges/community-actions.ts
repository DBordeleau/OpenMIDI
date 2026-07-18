"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  reportChallengeContent,
  setChallengeVote,
} from "@/server/repositories/challenges";
import type { ChallengeCommunityActionState } from "./community-action-state";

const voteSchema = z.object({
  entryId: z.uuid(),
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
  requestId: z.uuid(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

const reportSchema = z.object({
  requestId: z.uuid(),
  targetKind: z.enum(["challenge", "entry"]),
  challengeId: z.uuid(),
  entryId: z.uuid().nullable(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  reason: z.enum([
    "spam",
    "harassment",
    "rights_concern",
    "vote_manipulation",
    "other",
  ]),
  details: z.string().trim().max(1000).nullable(),
});

export async function setChallengeVoteAction(
  _state: ChallengeCommunityActionState,
  formData: FormData,
): Promise<ChallengeCommunityActionState> {
  const parsed = voteSchema.safeParse({
    entryId: formData.get("entryId"),
    active: formData.get("active"),
    requestId: formData.get("requestId"),
    slug: formData.get("slug"),
  });
  if (!parsed.success)
    return { status: "error", message: "Reload before changing this vote." };
  try {
    const result = await setChallengeVote(parsed.data);
    if (result.error || !result.data)
      return { status: "error", message: voteError(result.error?.code) };
    if ("errorCode" in result.data)
      return { status: "error", message: voteError(result.data.errorCode) };
    revalidatePath(`/challenges/${parsed.data.slug}`);
    revalidatePath(
      `/challenges/${parsed.data.slug}/entries/${parsed.data.entryId}`,
    );
    return {
      status: "success",
      active: result.data.active,
      message: result.data.active
        ? "Your vote is active. Totals stay private until voting closes."
        : "Your vote was removed.",
    };
  } catch {
    return { status: "error", message: "The vote response was unavailable." };
  }
}

export async function reportChallengeContentAction(
  _state: ChallengeCommunityActionState,
  formData: FormData,
): Promise<ChallengeCommunityActionState> {
  const entryValue = String(formData.get("entryId") ?? "");
  const detailsValue = String(formData.get("details") ?? "").trim();
  const parsed = reportSchema.safeParse({
    requestId: formData.get("requestId"),
    targetKind: formData.get("targetKind"),
    challengeId: formData.get("challengeId"),
    entryId: entryValue || null,
    slug: formData.get("slug"),
    reason: formData.get("reason"),
    details: detailsValue || null,
  });
  if (!parsed.success)
    return {
      status: "error",
      message: "Choose a report reason and try again.",
    };
  const result = await reportChallengeContent(parsed.data);
  if (result.error)
    return {
      status: "error",
      message:
        result.error.code === "PT429"
          ? "Too many reports were submitted. Please wait before trying again."
          : "This report could not be recorded.",
    };
  return {
    status: "success",
    message:
      "Report recorded privately. Reporting alone does not hide the challenge or entry.",
  };
}

function voteError(code?: string) {
  if (code === "PT401") return "Sign in to vote.";
  if (code === "PT403")
    return "You cannot vote for your own entry, or this account is not eligible to vote.";
  if (code === "PT429")
    return "Too many vote attempts. Wait before trying again.";
  if (code === "PT409")
    return "Voting closed, the entry became unavailable, or this vote is under review.";
  return "This vote could not be changed.";
}
