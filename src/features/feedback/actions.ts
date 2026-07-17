"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  mutateAdminFeedback,
  submitFeedback,
} from "@/server/repositories/feedback";
import {
  adminFeedbackActionSchema,
  feedbackSubmissionSchema,
  formCheckbox,
} from "./schema";
import { getApplicationVersion } from "./server-context";
import type { FeedbackFormState } from "./types";

export type AdminFeedbackActionState = { message?: string };

export async function submitFeedbackAction(
  _state: FeedbackFormState,
  formData: FormData,
): Promise<FeedbackFormState> {
  const parsed = feedbackSubmissionSchema.safeParse({
    requestId: formData.get("requestId"),
    kind: formData.get("kind"),
    summary: formData.get("summary"),
    details: formData.get("details"),
    sourcePathname: formData.get("sourcePathname"),
    includeBrowserContext: formCheckbox(formData.get("includeBrowserContext")),
    browserContext: formData.get("browserContext"),
  });

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return {
      message: "Check the highlighted fields and try again.",
      fieldErrors: {
        kind: errors.kind?.[0],
        summary: errors.summary?.[0],
        details: errors.details?.[0],
        browserContext: errors.browserContext?.[0],
      },
    };
  }

  const result = await submitFeedback({
    requestId: parsed.data.requestId,
    kind: parsed.data.kind,
    summary: parsed.data.summary,
    details: parsed.data.details,
    sourcePathname: parsed.data.sourcePathname,
    applicationVersion: getApplicationVersion(),
    browserContext: parsed.data.includeBrowserContext
      ? parsed.data.browserContext
      : null,
  });

  if (result.error) {
    const message =
      result.error.code === "PT429"
        ? "You’ve reached the feedback limit for now. Please try again later."
        : result.error.code === "PT409"
          ? "This submission ID was already used with different feedback. Refresh and try again."
          : result.error.code === "PT403"
            ? "This account is not eligible to send beta feedback."
            : "We couldn’t save your feedback. Your text is still here—please try again.";
    return { message };
  }

  return {
    message: "Thanks—your feedback is safely in the triage queue.",
    referenceId: result.data?.reference_id,
  };
}

export async function mutateAdminFeedbackAction(
  _state: AdminFeedbackActionState,
  formData: FormData,
): Promise<AdminFeedbackActionState> {
  const parsed = adminFeedbackActionSchema.safeParse({
    feedbackId: formData.get("feedbackId"),
    requestId: formData.get("requestId"),
    action: formData.get("action"),
    expectedLockVersion: formData.get("expectedLockVersion"),
    kind: formData.get("kind") || undefined,
    note: formData.get("note") ?? "",
    deletionReason: formData.get("deletionReason") ?? "",
    confirmDelete: formCheckbox(formData.get("confirmDelete")),
  });
  if (!parsed.success)
    return { message: "Check the action details and confirmation." };

  const { error } = await mutateAdminFeedback(parsed.data);
  if (error) {
    return {
      message:
        error.code === "PT409"
          ? "This feedback changed. Reload before acting."
          : error.code === "PT404"
            ? "This feedback is no longer available."
            : "The feedback action could not be saved.",
    };
  }

  revalidatePath("/admin/feedback");
  revalidatePath(`/admin/feedback/${parsed.data.feedbackId}`);
  if (parsed.data.action === "delete") redirect("/admin/feedback?updated=1");
  redirect(`/admin/feedback/${parsed.data.feedbackId}?updated=1`);
}
