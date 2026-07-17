import "server-only";

import { z } from "zod";
import { decodeAdminFeedbackCursor } from "@/features/feedback/admin-cursor";
import {
  feedbackKindSchema,
  feedbackStatusSchema,
} from "@/features/feedback/schema";
import type {
  AdminFeedbackDetail,
  FeedbackKind,
} from "@/features/feedback/types";
import { encodeNavigationCursor } from "@/features/navigation/cursor";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const submissionResultSchema = z.array(
  z.object({
    reference_id: z.string().min(1),
    created_at: z.string(),
  }),
);

const queueRowSchema = z.object({
  id: z.uuid(),
  reference_id: z.string(),
  kind: feedbackKindSchema,
  summary: z.string(),
  source_pathname: z.string(),
  created_at: z.string(),
  status: feedbackStatusSchema,
  lock_version: z.number().int().positive(),
  has_browser_context: z.boolean(),
});

const detailSchema: z.ZodType<AdminFeedbackDetail> = z.object({
  id: z.uuid(),
  referenceId: z.string(),
  kind: feedbackKindSchema,
  summary: z.string(),
  details: z.string(),
  sourcePathname: z.string(),
  applicationVersion: z.string(),
  browserContext: z.string().nullable(),
  status: feedbackStatusSchema,
  lockVersion: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
  handledAt: z.string().nullable(),
  handledBy: z.uuid().nullable(),
  adminNote: z.string().nullable(),
  submitterId: z.uuid(),
  submitterUsername: z.string().nullable(),
});

export async function submitFeedback(input: {
  requestId: string;
  kind: FeedbackKind;
  summary: string;
  details: string;
  sourcePathname: string;
  applicationVersion: string;
  browserContext: string | null;
}) {
  const db = await createSupabaseServerClient();
  const result = await db.rpc("submit_beta_feedback", {
    p_request_id: input.requestId,
    p_kind: input.kind,
    p_summary: input.summary,
    p_details: input.details,
    p_source_pathname: input.sourcePathname,
    p_application_version: input.applicationVersion,
    p_browser_context: input.browserContext ?? undefined,
  });
  if (result.error) return { data: null, error: result.error };
  return { data: submissionResultSchema.parse(result.data)[0], error: null };
}

export async function listAdminFeedback(input: {
  adminId: string;
  status: "new" | "handled" | null;
  kind: FeedbackKind | null;
  after?: string;
}) {
  const filter = `${input.status ?? "all"}:${input.kind ?? "all"}`;
  const cursor = decodeAdminFeedbackCursor(input.after, input.adminId, filter);
  if (input.after && !cursor) {
    throw new Error("feedback_cursor_invalid");
  }
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("list_admin_beta_feedback", {
    p_status: input.status ?? undefined,
    p_kind: input.kind ?? undefined,
    p_after_created_at: cursor?.timestamp,
    p_after_id: cursor?.id,
  });
  if (error) throw new Error("feedback_queue_unavailable");
  const rows = z.array(queueRowSchema).parse(data);
  const page = rows.slice(0, 24);
  const last = rows.length > 24 ? page.at(-1) : null;
  return {
    items: page.map((row) => ({
      id: row.id,
      referenceId: row.reference_id,
      kind: row.kind,
      summary: row.summary,
      sourcePathname: row.source_pathname,
      createdAt: row.created_at,
      status: row.status,
      lockVersion: row.lock_version,
      hasBrowserContext: row.has_browser_context,
    })),
    nextCursor: last
      ? encodeNavigationCursor({
          v: 1,
          kind: "admin-feedback",
          subject: input.adminId,
          filter,
          timestamp: last.created_at,
          id: last.id,
        })
      : null,
  };
}

export async function getAdminFeedback(feedbackId: string) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("get_admin_beta_feedback", {
    p_feedback_id: feedbackId,
  });
  if (error || !data) return null;
  return detailSchema.parse(data);
}

export async function mutateAdminFeedback(input: {
  feedbackId: string;
  requestId: string;
  action: "classify" | "handle" | "reopen" | "delete";
  expectedLockVersion: number;
  kind?: FeedbackKind;
  note: string | null;
  deletionReason: string | null;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("mutate_admin_beta_feedback", {
    p_feedback_id: input.feedbackId,
    p_request_id: input.requestId,
    p_action: input.action,
    p_expected_lock_version: input.expectedLockVersion,
    p_kind: input.kind,
    p_note: input.note ?? undefined,
    p_deletion_reason: input.deletionReason ?? undefined,
  });
}
