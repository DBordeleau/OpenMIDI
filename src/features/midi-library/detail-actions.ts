"use server";

import { revalidatePath } from "next/cache";
import {
  midiLibraryModerationActionSchema,
  midiLibraryReportInputSchema,
} from "./detail";
import {
  applyMidiLibraryModerationAction,
  submitMidiLibraryReport,
} from "@/server/repositories/midi-library";

export type MidiLibraryActionState = {
  status: "idle" | "success" | "error";
  message: string;
  referenceId?: string;
};

function optionalText(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function reportError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("unauthenticated"))
    return "Sign in before sending a private report.";
  if (message.includes("rate_limited"))
    return "You have reached the daily report limit. Try again tomorrow.";
  if (message.includes("already_open"))
    return "You already have an open report for this listing.";
  if (message.includes("self_denied"))
    return "You cannot report your own listing through this form.";
  return "The report could not be submitted. Check the evidence fields and try again.";
}

export async function submitMidiLibraryReportAction(
  _previous: MidiLibraryActionState,
  formData: FormData,
): Promise<MidiLibraryActionState> {
  const parsed = midiLibraryReportInputSchema.safeParse({
    listingId: formData.get("listingId"),
    requestId: formData.get("requestId"),
    claimantRole: formData.get("claimantRole"),
    originalWorkTitle: optionalText(formData.get("originalWorkTitle")),
    sourceUrl: optionalText(formData.get("sourceUrl")),
    evidence: formData.get("evidence"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message:
        "Add at least 20 characters of evidence and use an HTTPS source link.",
    };
  }
  try {
    const report = await submitMidiLibraryReport(parsed.data);
    return {
      status: "success",
      message:
        "Your private report was recorded. It did not hide the listing automatically.",
      referenceId: report.report_id,
    };
  } catch (error) {
    return { status: "error", message: reportError(error) };
  }
}

export async function applyMidiLibraryModerationActionAction(
  _previous: MidiLibraryActionState,
  formData: FormData,
): Promise<MidiLibraryActionState> {
  const parsed = midiLibraryModerationActionSchema.safeParse({
    reportId: formData.get("reportId"),
    requestId: formData.get("requestId"),
    action: formData.get("action"),
    reason: formData.get("reason"),
    expectedReportStatus: formData.get("expectedReportStatus"),
    expectedTargetVersion: Number(formData.get("expectedTargetVersion")),
  });
  if (!parsed.success)
    return {
      status: "error",
      message: "Choose an action and add a concise decision note.",
    };
  try {
    await applyMidiLibraryModerationAction(parsed.data);
    revalidatePath("/library");
    revalidatePath(`/library/${formData.get("listingId") ?? ""}`);
    revalidatePath("/admin/library-moderation");
    return {
      status: "success",
      message: "The moderation action was recorded.",
      referenceId: parsed.data.requestId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return {
      status: "error",
      message: message.includes("conflict")
        ? "This report or listing changed. Reload before applying another action."
        : "The moderation action could not be applied.",
    };
  }
}
