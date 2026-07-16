import "server-only";

import { z } from "zod";
import type { DashboardData } from "@/features/dashboard/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const rowBase = { updated_at: z.string() };
const dashboardSchema = z.object({
  ownedProjects: z.array(
    z.object({
      project_id: z.string().uuid(),
      title: z.string(),
      status: z.enum(["draft", "active"]),
      current_revision_id: z.string().uuid().nullable(),
      ...rowBase,
    }),
  ),
  activeWorkspaces: z.array(
    z.object({
      workspace_id: z.string().uuid(),
      project_id: z.string().uuid(),
      project_title: z.string(),
      contribution_id: z.string().uuid().nullable(),
      contribution_title: z.string().nullable(),
      lock_version: z.number().int().positive(),
      ...rowBase,
    }),
  ),
  pendingContributions: z.array(
    z.object({
      contribution_id: z.string().uuid(),
      project_id: z.string().uuid(),
      project_title: z.string(),
      title: z.string(),
      status: z.enum(["draft", "submitted", "changes_requested"]),
      current_version_number: z.number().int().positive().nullable(),
      ...rowBase,
    }),
  ),
  review: z.object({
    count: z.number().int().min(0).max(99),
    hasMore: z.boolean(),
  }),
});

export async function getViewerDashboard(): Promise<DashboardData> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("get_viewer_dashboard");
  if (error) throw new Error("dashboard_unavailable");
  const value = dashboardSchema.parse(data);
  const now = Date.now();
  return {
    ownedProjects: value.ownedProjects.slice(0, 6).map((row) => ({
      projectId: row.project_id,
      title: row.title,
      status: row.status,
      currentRevisionId: row.current_revision_id,
      updatedAt: row.updated_at,
    })),
    activeWorkspaces: value.activeWorkspaces.slice(0, 6).map((row) => {
      const updatedAt = new Date(row.updated_at).getTime();
      return {
        workspaceId: row.workspace_id,
        projectId: row.project_id,
        projectTitle: row.project_title,
        contributionId: row.contribution_id,
        contributionTitle: row.contribution_title,
        lockVersion: row.lock_version,
        updatedAt: row.updated_at,
        archivesAt: new Date(
          updatedAt + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        archiveWarning: now - updatedAt >= 23 * 24 * 60 * 60 * 1000,
      };
    }),
    pendingContributions: value.pendingContributions.slice(0, 6).map((row) => ({
      contributionId: row.contribution_id,
      projectId: row.project_id,
      projectTitle: row.project_title,
      title: row.title,
      status: row.status,
      currentVersionNumber: row.current_version_number,
      updatedAt: row.updated_at,
    })),
    review: value.review,
  };
}
