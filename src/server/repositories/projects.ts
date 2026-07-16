import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProjectInput } from "@/features/projects/schema";
import type {
  ProjectDetail,
  ProjectFormOptions,
  ProjectSummary,
  ProjectSummaryPage,
} from "@/features/projects/types";
import type { Database } from "@/lib/supabase/database.types";
import { z } from "zod";
import {
  decodeNavigationCursor,
  encodeNavigationCursor,
} from "@/features/navigation/cursor";

export async function listProjectFormOptions(): Promise<ProjectFormOptions> {
  const db = await createSupabaseServerClient();
  const [licenses, genres, tags] = await Promise.all([
    db
      .from("licenses")
      .select(
        "code,name,url,summary,allows_derivatives,requires_attribution,share_alike",
      )
      .order("sort_order"),
    db.from("genres").select("id,slug,name").order("sort_order"),
    db.from("tags").select("id,slug,display_name").order("sort_order"),
  ]);
  if (licenses.error || genres.error || tags.error)
    throw new Error("project_options_unavailable");
  return {
    licenses: licenses.data.map((license) => ({
      code: license.code,
      name: license.name,
      url: license.url,
      summary: license.summary,
      allowsDerivatives: license.allows_derivatives,
      requiresAttribution: license.requires_attribution,
      shareAlike: license.share_alike,
    })),
    genres: genres.data,
    tags: tags.data.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.display_name,
    })),
  };
}

export async function listProjectsForViewer(
  viewerId: string,
  options: { scope?: "all" | "owned"; review?: boolean; after?: string } = {},
): Promise<ProjectSummaryPage> {
  const scope = options.scope ?? "all";
  const filter = `${scope}:${options.review ? "review" : "all"}`;
  const cursor = decodeNavigationCursor(options.after);
  if (
    options.after &&
    (!cursor ||
      cursor.kind !== "projects" ||
      cursor.subject !== viewerId ||
      cursor.filter !== filter)
  )
    throw new Error("projects_cursor_invalid");
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("list_viewer_projects", {
    p_scope: scope,
    p_review: options.review ?? false,
    p_after_updated_at: cursor?.timestamp,
    p_after_id: cursor?.id,
  });
  if (error) throw new Error("projects_unavailable");
  const rows = z
    .array(
      z.object({
        project_id: z.string().uuid(),
        title: z.string(),
        description: z.string().nullable(),
        status: z.enum(["draft", "active", "archived"]),
        role: z.enum(["owner", "editor", "viewer"]),
        current_revision_id: z.string().uuid().nullable(),
        updated_at: z.string(),
        needs_review: z.boolean(),
      }),
    )
    .parse(data);
  const visible = rows.slice(0, 24);
  const { data: workspaces, error: workspaceError } = visible.length
    ? await db
        .from("workspaces")
        .select("project_id,contribution_id")
        .eq("owner_id", viewerId)
        .eq("status", "active")
        .in(
          "project_id",
          visible.map((project) => project.project_id),
        )
    : { data: [], error: null };
  if (workspaceError) throw new Error("projects_unavailable");
  const workspaceByProject = new Map(
    workspaces.map((workspace) => [workspace.project_id, workspace]),
  );
  const projects: ProjectSummary[] = visible.map((project) => ({
    id: project.project_id,
    title: project.title,
    description: project.description,
    status: project.status,
    role: project.role,
    currentRevisionId: project.current_revision_id,
    updatedAt: project.updated_at,
    needsReview: project.needs_review,
    studioAccess: workspaceByProject.has(project.project_id)
      ? workspaceByProject.get(project.project_id)!.contribution_id
        ? "contribution_workspace"
        : "owner_workspace"
      : project.role === "owner"
        ? "workspace_available"
        : "read_only",
  }));
  const last = rows.length > 24 ? visible.at(-1) : null;
  return {
    projects,
    nextCursor: last
      ? encodeNavigationCursor({
          v: 1,
          kind: "projects",
          subject: viewerId,
          filter,
          timestamp: last.updated_at,
          id: last.project_id,
        })
      : null,
  };
}

const rpcArgs = (input: ProjectInput) => ({
  p_title: input.title,
  p_description: input.description,
  p_bpm: input.bpm,
  p_musical_key: input.musicalKey,
  p_time_signature_numerator: input.timeSignatureNumerator,
  p_time_signature_denominator: input.timeSignatureDenominator,
  p_license_code: input.licenseCode,
  p_genre_ids: input.genreIds,
  p_primary_genre_id: input.primaryGenreId,
  p_tag_ids: input.tagIds,
});
export async function createProject(input: ProjectInput, requestId: string) {
  const db = await createSupabaseServerClient();
  const args = {
    p_request_id: requestId,
    ...rpcArgs(input),
    p_description: input.description ?? "",
  } as unknown as Database["public"]["Functions"]["create_project"]["Args"];
  return db.rpc("create_midi_project_workspace", args);
}
export async function updateProjectMetadata(
  projectId: string,
  lockVersion: number,
  input: ProjectInput,
) {
  const db = await createSupabaseServerClient();
  const args = {
    p_project_id: projectId,
    p_expected_lock_version: lockVersion,
    ...rpcArgs(input),
  } as unknown as Database["public"]["Functions"]["update_project_metadata"]["Args"];
  return db.rpc("update_project_metadata", args);
}

export async function setProjectVisibility(input: {
  projectId: string;
  expectedLockVersion: number;
  visibility: "private" | "public";
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("set_project_visibility", {
    p_project_id: input.projectId,
    p_expected_lock_version: input.expectedLockVersion,
    p_visibility: input.visibility,
  });
}

export async function deleteProject(input: {
  projectId: string;
  requestId: string;
  expectedLockVersion: number;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("delete_project", {
    p_project_id: input.projectId,
    p_request_id: input.requestId,
    p_expected_lock_version: input.expectedLockVersion,
  });
}

export async function getProjectForViewer(
  projectId: string,
): Promise<ProjectDetail | null> {
  const db = await createSupabaseServerClient();
  const { data: project, error } = await db
    .from("projects")
    .select(
      "id,owner_id,title,description,bpm,musical_key,time_signature_numerator,time_signature_denominator,lock_version,open_to_contributions,visibility,status,current_revision_id,source_project_id,source_revision_id,published_at,created_at,updated_at,license_code,compatibility,moderation_state,project_members(role)",
    )
    .eq("id", projectId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !project) return null;
  const [license, genres, tags] = await Promise.all([
    db
      .from("licenses")
      .select(
        "code,name,url,summary,allows_derivatives,requires_attribution,share_alike",
      )
      .eq("code", project.license_code)
      .single(),
    db
      .from("project_genres")
      .select("is_primary,genres(id,slug,name)")
      .eq("project_id", projectId),
    db
      .from("project_tags")
      .select("tags(id,slug,display_name)")
      .eq("project_id", projectId),
  ]);
  if (license.error || genres.error || tags.error)
    throw new Error("project_detail_unavailable");
  return {
    id: project.id,
    ownerId: project.owner_id,
    title: project.title,
    description: project.description,
    bpm: project.bpm === null ? null : Number(project.bpm),
    musicalKey: project.musical_key as ProjectDetail["musicalKey"],
    timeSignature: {
      numerator: project.time_signature_numerator,
      denominator: project.time_signature_denominator,
    },
    license: {
      code: license.data.code,
      name: license.data.name,
      url: license.data.url,
      summary: license.data.summary,
      allowsDerivatives: license.data.allows_derivatives,
      requiresAttribution: license.data.requires_attribution,
      shareAlike: license.data.share_alike,
    },
    genres: genres.data.map((row) => ({
      ...row.genres,
      isPrimary: row.is_primary,
    })),
    tags: tags.data.map((row) => ({
      id: row.tags.id,
      slug: row.tags.slug,
      name: row.tags.display_name,
    })),
    lockVersion: project.lock_version,
    viewerRole: project.project_members[0]!.role,
    openToContributions: project.open_to_contributions,
    visibility: project.visibility as ProjectDetail["visibility"],
    status: project.status as ProjectDetail["status"],
    currentRevisionId: project.current_revision_id,
    sourceProjectId: project.source_project_id,
    sourceRevisionId: project.source_revision_id,
    publishedAt: project.published_at,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    compatibility: project.compatibility as ProjectDetail["compatibility"],
    moderationState:
      project.moderation_state as ProjectDetail["moderationState"],
  };
}
