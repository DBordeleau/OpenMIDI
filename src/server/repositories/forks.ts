import "server-only";

import type { ForkProjectInput } from "@/features/forks/schema";
import type { ForkSource, ProjectLineage } from "@/features/forks/types";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicProject } from "@/server/repositories/public-projects";

export async function getForkSourceForViewer(input: {
  projectId: string;
  revisionId: string;
}): Promise<ForkSource | null> {
  const db = await createSupabaseServerClient();
  const [projectResult, revisionResult] = await Promise.all([
    db
      .from("projects")
      .select("id,title,description,status,deleted_at,license_code")
      .eq("id", input.projectId)
      .maybeSingle(),
    db
      .from("project_revisions")
      .select("id,project_id,revision_number,duration_ms,revision_tracks(id)")
      .eq("project_id", input.projectId)
      .eq("id", input.revisionId)
      .maybeSingle(),
  ]);
  if (projectResult.error || revisionResult.error)
    throw new Error("fork_source_unavailable");
  const project = projectResult.data;
  const revision = revisionResult.data;
  if (!project || !revision) {
    const publicProject = await getPublicProject(input.projectId);
    if (!publicProject || publicProject.currentRevisionId !== input.revisionId)
      return null;
    const { data: publicLicense, error: publicLicenseError } = await db
      .from("licenses")
      .select(
        "code,name,url,summary,allows_derivatives,requires_attribution,share_alike",
      )
      .eq("code", publicProject.license.code)
      .maybeSingle();
    if (publicLicenseError) throw new Error("fork_source_unavailable");
    if (!publicLicense) return null;
    return {
      projectId: publicProject.projectId,
      projectTitle: publicProject.title,
      projectDescription: publicProject.description,
      revisionId: publicProject.currentRevisionId,
      revisionNumber: publicProject.revisionNumber,
      durationMs: publicProject.durationMs,
      trackCount: publicProject.tracks.length,
      license: {
        code: publicLicense.code,
        name: publicLicense.name,
        url: publicLicense.url,
        summary: publicLicense.summary,
        allowsDerivatives: publicLicense.allows_derivatives,
        requiresAttribution: publicLicense.requires_attribution,
        shareAlike: publicLicense.share_alike,
      },
    };
  }
  if (project.status !== "active" || project.deleted_at !== null) return null;

  const { data: license, error: licenseError } = await db
    .from("licenses")
    .select(
      "code,name,url,summary,allows_derivatives,requires_attribution,share_alike",
    )
    .eq("code", project.license_code)
    .maybeSingle();
  if (licenseError) throw new Error("fork_source_unavailable");
  if (!license) return null;

  return {
    projectId: project.id,
    projectTitle: project.title,
    projectDescription: project.description,
    revisionId: revision.id,
    revisionNumber: revision.revision_number,
    durationMs: revision.duration_ms,
    trackCount: revision.revision_tracks.length,
    license: {
      code: license.code,
      name: license.name,
      url: license.url,
      summary: license.summary,
      allowsDerivatives: license.allows_derivatives,
      requiresAttribution: license.requires_attribution,
      shareAlike: license.share_alike,
    },
  };
}

export async function forkProject(input: ForkProjectInput) {
  const db = await createSupabaseServerClient();
  return db.rpc("fork_project", {
    p_source_project_id: input.sourceProjectId,
    p_source_revision_id: input.sourceRevisionId,
    p_request_id: input.requestId,
    p_expected_license_code: input.expectedLicenseCode,
    p_title: input.title,
    p_description: input.description,
  } as Database["public"]["Functions"]["fork_project"]["Args"]);
}

export async function getProjectLineage(input: {
  projectId: string;
  sourceProjectId: string | null;
  sourceRevisionId: string | null;
}): Promise<ProjectLineage> {
  const db = await createSupabaseServerClient();
  const childrenPromise = db
    .from("projects")
    .select("id,title,created_at")
    .eq("source_project_id", input.projectId)
    .is("deleted_at", null)
    .neq("status", "deleted")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(21);

  const sourcePromise =
    input.sourceProjectId && input.sourceRevisionId
      ? Promise.all([
          db
            .from("projects")
            .select("id,title")
            .eq("id", input.sourceProjectId)
            .maybeSingle(),
          db
            .from("project_revisions")
            .select("id,project_id,revision_number")
            .eq("project_id", input.sourceProjectId)
            .eq("id", input.sourceRevisionId)
            .maybeSingle(),
        ])
      : null;

  const [childrenResult, sourceResults] = await Promise.all([
    childrenPromise,
    sourcePromise,
  ]);
  if (childrenResult.error) throw new Error("project_lineage_unavailable");

  let source: ProjectLineage["source"] = null;
  if (sourceResults) {
    const [projectResult, revisionResult] = sourceResults;
    if (projectResult.error || revisionResult.error)
      throw new Error("project_lineage_unavailable");
    if (projectResult.data && revisionResult.data) {
      source = {
        projectId: projectResult.data.id,
        title: projectResult.data.title,
        revisionId: revisionResult.data.id,
        revisionNumber: revisionResult.data.revision_number,
      };
    }
  }

  return {
    source,
    sourceUnavailable:
      input.sourceProjectId !== null &&
      input.sourceRevisionId !== null &&
      !source,
    directForks: childrenResult.data.slice(0, 20).map((project) => ({
      projectId: project.id,
      title: project.title,
      createdAt: project.created_at,
    })),
    hasMoreDirectForks: childrenResult.data.length > 20,
  };
}
