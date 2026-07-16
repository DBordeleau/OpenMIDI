import "server-only";

import { z } from "zod";
import {
  decodeNavigationCursor,
  encodeNavigationCursor,
} from "@/features/navigation/cursor";
import type {
  ModerationActionInput,
  ReportInput,
} from "@/features/moderation/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const reportRowSchema = z.object({
  id: z.string().uuid(),
  target_kind: z.enum(["profile", "project", "contribution"]),
  target_label: z.string(),
  status: z.enum(["submitted", "reviewing", "closed"]),
  created_at: z.string(),
  resolved_at: z.string().nullable(),
});
const adminQueueRowSchema = z.object({
  id: z.string().uuid(),
  target_kind: z.enum(["profile", "project", "contribution"]),
  target_label_snapshot: z.string(),
  reason: z.string(),
  status: z.enum(["submitted", "reviewing"]),
  created_at: z.string(),
  updated_at: z.string(),
  assigned: z.boolean(),
});
const adminTargetSchema = z.object({
  id: z.string().uuid(),
  targetKind: z.enum(["profile", "project", "contribution"]),
  targetId: z.string().uuid(),
  targetLabel: z.string(),
  reason: z.string(),
  detail: z.string().nullable(),
  status: z.enum(["submitted", "reviewing", "resolved", "dismissed"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  targetVersion: z.number().int().positive(),
  targetState: z.enum(["visible", "hidden"]),
  targetAccountStatus: z
    .enum(["incomplete", "active", "suspended", "deleted"])
    .nullable(),
  holds: z.array(
    z.object({
      id: z.string().uuid(),
      type: z.enum(["legal", "abuse"]),
      placedAt: z.string(),
      expiresAt: z.string().nullable(),
    }),
  ),
});

export async function submitReport(input: ReportInput) {
  const db = await createSupabaseServerClient();
  return db.rpc("submit_moderation_report", {
    p_request_id: input.requestId,
    p_target_kind: input.targetKind,
    p_target_id: input.targetId,
    p_reason: input.reason,
    p_detail: input.detail ?? undefined,
  });
}

export async function listViewerReports(viewerId: string, after?: string) {
  const cursor = decodeNavigationCursor(after);
  if (
    after &&
    (!cursor || cursor.kind !== "reports" || cursor.subject !== viewerId)
  )
    throw new Error("reports_cursor_invalid");
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("list_viewer_reports", {
    p_after_created_at: cursor?.timestamp,
    p_after_id: cursor?.id,
  });
  if (error) throw new Error("reports_unavailable");
  const rows = z.array(reportRowSchema).parse(data);
  const reports = rows.slice(0, 24);
  const last = rows.length > 24 ? reports.at(-1) : null;
  return {
    reports,
    nextCursor: last
      ? encodeNavigationCursor({
          v: 1,
          kind: "reports",
          subject: viewerId,
          filter: "viewer",
          timestamp: last.created_at,
          id: last.id,
        })
      : null,
  };
}

export async function assertViewerAdmin() {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("assert_viewer_admin");
  return !error && data === true;
}

export async function listAdminModerationQueue(
  adminId: string,
  after?: string,
) {
  const cursor = decodeNavigationCursor(after);
  if (
    after &&
    (!cursor ||
      cursor.kind !== "admin-moderation" ||
      cursor.subject !== adminId)
  )
    throw new Error("admin_cursor_invalid");
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("list_admin_moderation_queue", {
    p_after_created_at: cursor?.timestamp,
    p_after_id: cursor?.id,
  });
  if (error) throw new Error("admin_queue_unavailable");
  const rows = z.array(adminQueueRowSchema).parse(data);
  const reports = rows.slice(0, 24);
  const last = rows.length > 24 ? reports.at(-1) : null;
  return {
    reports,
    nextCursor: last
      ? encodeNavigationCursor({
          v: 1,
          kind: "admin-moderation",
          subject: adminId,
          filter: "open",
          timestamp: last.created_at,
          id: last.id,
        })
      : null,
  };
}

export async function getAdminModerationTarget(reportId: string) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("get_admin_moderation_target", {
    p_report_id: reportId,
  });
  if (error || !data) return null;
  return adminTargetSchema.parse(data);
}

export async function applyModerationAction(input: ModerationActionInput) {
  const db = await createSupabaseServerClient();
  return db.rpc("apply_moderation_action", {
    p_report_id: input.reportId,
    p_request_id: input.requestId,
    p_action: input.action,
    p_reason: input.reason,
    p_expected_report_status: input.expectedReportStatus,
    p_expected_target_version: input.expectedTargetVersion,
  });
}

export async function placeContentHold(input: {
  requestId: string;
  targetKind: "profile" | "project" | "contribution";
  targetId: string;
  holdType: "legal" | "abuse";
  reason: string;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("place_content_hold", {
    p_request_id: input.requestId,
    p_target_kind: input.targetKind,
    p_target_id: input.targetId,
    p_hold_type: input.holdType,
    p_reason: input.reason,
    p_expires_at: undefined,
  });
}

export async function releaseContentHold(input: {
  holdId: string;
  requestId: string;
  reason: string;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("release_content_hold", {
    p_hold_id: input.holdId,
    p_request_id: input.requestId,
    p_reason: input.reason,
  });
}

const storageSummarySchema = z.object({
  thresholds: z.object({ warningBytes: z.number(), stopBytes: z.number() }),
  total: z.object({
    objectCount: z.number(),
    bytes: z.number(),
    unknownSizeCount: z.number(),
  }),
  buckets: z.array(
    z.object({
      bucket: z.string(),
      object_count: z.number(),
      bytes: z.number(),
      unknown_size_count: z.number(),
    }),
  ),
  untrackedObjectCount: z.number(),
  dueCleanupCount: z.number(),
  lastRun: z
    .object({
      id: z.string().uuid(),
      status: z.string(),
      requestedAt: z.string(),
      completedAt: z.string().nullable(),
      candidateCount: z.number(),
      completedCount: z.number(),
      blockedCount: z.number(),
      failedCount: z.number(),
    })
    .nullable(),
});

export async function getAdminStorageSummary() {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("get_admin_storage_summary");
  if (error) throw new Error("storage_summary_unavailable");
  return storageSummarySchema.parse(data);
}
