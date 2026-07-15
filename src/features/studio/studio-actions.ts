"use server";

import { requireViewer } from "@/features/auth/guards";
import type { ProjectSummaryPage } from "@/features/projects/types";
import { listProjectsForViewer } from "@/server/repositories/projects";

export async function listStudioProjectsAction(
  after: string,
): Promise<ProjectSummaryPage> {
  const viewer = await requireViewer("/studio");
  return listProjectsForViewer(viewer.id, { after });
}
