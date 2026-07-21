import "server-only";

import { z } from "zod";
import {
  DAYS_TO_MILLISECONDS,
  WORKSPACE_ARCHIVE_AFTER_DAYS,
  WORKSPACE_ARCHIVE_WARNING_AFTER_DAYS,
} from "@/features/dashboard/archive-policy";
import type { DashboardData } from "@/features/dashboard/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const rowBase = { updated_at: z.string() };
const boundedCountSchema = z.object({
  count: z.number().int().min(0).max(99),
  hasMore: z.boolean(),
});
const resumeClipSchema = z.object({
  clip_id: z.string().uuid(),
  start_tick: z.number().int().min(0),
  duration_ticks: z.number().int().positive(),
  pattern_name: z.string().nullable(),
});
const dashboardSchema = z.object({
  ownedProjects: z.array(
    z.object({
      project_id: z.string().uuid(),
      title: z.string(),
      status: z.enum(["draft", "active"]),
      current_revision_id: z.string().uuid().nullable(),
      revision_number: z.number().int().positive().nullable(),
      track_count: z.number().int().min(0),
      review_count: z.number().int().min(0).max(99),
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
  review: boundedCountSchema,
  resume: z
    .object({
      workspace_id: z.string().uuid(),
      project_id: z.string().uuid(),
      project_title: z.string(),
      contribution_id: z.string().uuid().nullable(),
      contribution_title: z.string().nullable(),
      updated_at: z.string(),
      lock_version: z.number().int().positive(),
      tempo_bpm: z.number().min(20).max(300),
      duration_ticks: z.number().int().positive(),
      musical_key: z.string().nullable(),
      time_signature_numerator: z.number().int().min(1).max(32),
      time_signature_denominator: z.number().int().positive(),
      tracks: z.array(
        z.object({
          track_id: z.string().uuid(),
          sort_order: z.number().int().min(0),
          preset_id: z.string(),
          name: z.string(),
          clips: z.array(resumeClipSchema),
        }),
      ),
    })
    .nullable(),
  recentClips: z.array(
    z.object({
      pattern_id: z.string().uuid(),
      pattern_name: z.string(),
      pattern_version_id: z.string().uuid(),
      version_number: z.number().int().positive(),
      project_id: z.string().uuid(),
      project_title: z.string(),
      workspace_id: z.string().uuid(),
      clip_id: z.string().uuid(),
      duration_ticks: z.number().int().positive(),
      note_count: z.number().int().min(0),
      updated_at: z.string(),
    }),
  ),
  counts: z.object({
    projects: boundedCountSchema,
    clips: boundedCountSchema,
    savedClips: boundedCountSchema,
    pendingContributions: boundedCountSchema,
    archivingSoon: boundedCountSchema,
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
      revisionNumber: row.revision_number,
      trackCount: row.track_count,
      reviewCount: row.review_count,
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
          updatedAt + WORKSPACE_ARCHIVE_AFTER_DAYS * DAYS_TO_MILLISECONDS,
        ).toISOString(),
        archiveWarning:
          now - updatedAt >=
          WORKSPACE_ARCHIVE_WARNING_AFTER_DAYS * DAYS_TO_MILLISECONDS,
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
    resume: value.resume
      ? {
          workspaceId: value.resume.workspace_id,
          projectId: value.resume.project_id,
          projectTitle: value.resume.project_title,
          contributionId: value.resume.contribution_id,
          contributionTitle: value.resume.contribution_title,
          updatedAt: value.resume.updated_at,
          lockVersion: value.resume.lock_version,
          tempoBpm: value.resume.tempo_bpm,
          durationTicks: value.resume.duration_ticks,
          musicalKey: value.resume.musical_key,
          timeSignatureNumerator: value.resume.time_signature_numerator,
          timeSignatureDenominator: value.resume.time_signature_denominator,
          tracks: value.resume.tracks.map((track) => ({
            trackId: track.track_id,
            sortOrder: track.sort_order,
            presetId: track.preset_id,
            name: track.name,
            clips: track.clips.map((clip) => ({
              clipId: clip.clip_id,
              startTick: clip.start_tick,
              durationTicks: clip.duration_ticks,
              patternName: clip.pattern_name,
            })),
          })),
        }
      : null,
    recentClips: value.recentClips.slice(0, 6).map((row) => ({
      patternId: row.pattern_id,
      patternName: row.pattern_name,
      patternVersionId: row.pattern_version_id,
      versionNumber: row.version_number,
      projectId: row.project_id,
      projectTitle: row.project_title,
      workspaceId: row.workspace_id,
      clipId: row.clip_id,
      durationTicks: row.duration_ticks,
      noteCount: row.note_count,
      updatedAt: row.updated_at,
    })),
    counts: value.counts,
  };
}
