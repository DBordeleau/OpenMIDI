"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import {
  PUBLIC_PROJECTS_CACHE_TAG,
  publicProjectCacheTag,
} from "@/lib/cache/public-projects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  applyModerationAction,
  placeContentHold,
  releaseContentHold,
  submitReport,
} from "@/server/repositories/moderation";
import {
  accountDeletionSchema,
  contributionDeletionSchema,
  holdActionSchema,
  moderationActionSchema,
  reportInputSchema,
} from "./schema";

export type FormState = { message?: string };

export async function submitReportAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = reportInputSchema.safeParse({
    requestId: formData.get("requestId"),
    targetKind: formData.get("targetKind"),
    targetId: formData.get("targetId"),
    reason: formData.get("reason"),
    detail: formData.get("detail"),
  });
  if (!parsed.success) return { message: "Check the report and try again." };
  const { data, error } = await submitReport(parsed.data);
  if (error) {
    if (error.code === "PT409")
      return { message: "You already have an open report for this item." };
    if (error.code === "PT429")
      return { message: "You’ve reached today’s report limit." };
    return { message: "We couldn’t submit this report." };
  }
  redirect(`/reports?submitted=${data[0]?.report_id ?? "1"}`);
}

export async function applyModerationActionAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = moderationActionSchema.safeParse({
    reportId: formData.get("reportId"),
    requestId: formData.get("requestId"),
    action: formData.get("action"),
    reason: formData.get("reason"),
    expectedReportStatus: formData.get("expectedReportStatus"),
    expectedTargetVersion: formData.get("expectedTargetVersion"),
  });
  if (!parsed.success) return { message: "Check the action and reason." };
  const { error } = await applyModerationAction(parsed.data);
  if (error)
    return {
      message:
        error.code === "PT409"
          ? "This report changed. Reload before acting."
          : "The moderation action could not be applied.",
    };
  updateTag(PUBLIC_PROJECTS_CACHE_TAG);
  revalidatePath("/admin/moderation");
  revalidatePath(`/admin/moderation/${parsed.data.reportId}`);
  redirect("/admin/moderation?updated=1");
}

export async function restoreProjectAction(formData: FormData) {
  const projectId = formData.get("projectId")?.toString();
  if (!projectId) return;
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("restore_project", {
    p_project_id: projectId,
    p_request_id: crypto.randomUUID(),
  });
  if (error) redirect(`/projects?restoreError=1&projectId=${projectId}`);
  updateTag(PUBLIC_PROJECTS_CACHE_TAG);
  updateTag(publicProjectCacheTag(projectId));
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?restored=1`);
}

export async function contentHoldAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = holdActionSchema.safeParse({
    requestId: formData.get("requestId"),
    operation: formData.get("operation"),
    targetKind: formData.get("targetKind") || undefined,
    targetId: formData.get("targetId") || undefined,
    holdId: formData.get("holdId") || undefined,
    holdType: formData.get("holdType") || undefined,
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { message: "Check the hold reason." };
  const value = parsed.data;
  const result =
    value.operation === "place" &&
    value.targetKind &&
    value.targetId &&
    value.holdType
      ? await placeContentHold({
          requestId: value.requestId,
          targetKind: value.targetKind,
          targetId: value.targetId,
          holdType: value.holdType,
          reason: value.reason,
        })
      : value.operation === "release" && value.holdId
        ? await releaseContentHold({
            holdId: value.holdId,
            requestId: value.requestId,
            reason: value.reason,
          })
        : { error: { code: "invalid" } };
  if (result.error) return { message: "The hold could not be updated." };
  revalidatePath("/admin/moderation");
  return { message: "Hold updated." };
}

export async function deleteContributionAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = contributionDeletionSchema.safeParse({
    contributionId: formData.get("contributionId"),
    requestId: formData.get("requestId"),
  });
  if (!parsed.success) return { message: "That deletion request is invalid." };
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("delete_own_contribution", {
    p_contribution_id: parsed.data.contributionId,
    p_request_id: parsed.data.requestId,
  });
  if (error)
    return { message: "This contribution cannot be deleted or is on hold." };
  redirect(
    `/contributions?deleted=1&contributionId=${parsed.data.contributionId}`,
  );
}

export async function restoreContributionAction(formData: FormData) {
  const contributionId = formData.get("contributionId")?.toString();
  if (!contributionId) return;
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("restore_own_contribution", {
    p_contribution_id: contributionId,
  });
  if (error) redirect("/contributions?restoreError=1&status=history");
  redirect(
    `/contributions?restored=1&status=history&contributionId=${contributionId}`,
  );
}

export async function requestAccountDeletionAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = accountDeletionSchema.safeParse({
    requestId: formData.get("requestId"),
    username: formData.get("username"),
  });
  if (!parsed.success) return { message: "Type your exact username." };
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("request_account_deletion", {
    p_request_id: parsed.data.requestId,
    p_username: parsed.data.username,
  });
  if (error) return { message: "We couldn’t start account deletion." };
  const { error: signOutError } = await db.auth.signOut({ scope: "global" });
  redirect(
    `/account-recovery?deleted=1&signOut=${signOutError ? "partial" : "complete"}`,
  );
}

export async function restoreAccountAction() {
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("restore_own_account");
  if (error) redirect("/account-recovery?error=1");
  redirect("/dashboard?recovered=1");
}
