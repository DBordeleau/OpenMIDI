import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProjectInput } from "@/features/projects/schema";
import type {
  ProjectDetail,
  ProjectFormOptions,
  ProjectSummary,
} from "@/features/projects/types";
import type { Database } from "@/lib/supabase/database.types";

export async function listProjectFormOptions(): Promise<ProjectFormOptions> {
  const db = await createSupabaseServerClient();
  const [licenses, genres, tags] = await Promise.all([
    db.from("licenses").select("code,name,url,summary").order("sort_order"),
    db.from("genres").select("id,slug,name").order("sort_order"),
    db.from("tags").select("id,slug,display_name").order("sort_order"),
  ]);
  if (licenses.error || genres.error || tags.error)
    throw new Error("project_options_unavailable");
  return {
    licenses: licenses.data,
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
): Promise<ProjectSummary[]> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("projects")
    .select(
      "id,title,description,status,current_revision_id,updated_at,project_members!inner(user_id,role)",
    )
    .eq("project_members.user_id", viewerId)
    .is("deleted_at", null)
    .neq("status", "deleted")
    .order("updated_at", { ascending: false });
  if (error) throw new Error("projects_unavailable");
  return data.map((project) => ({
    id: project.id,
    title: project.title,
    description: project.description,
    status: project.status as ProjectSummary["status"],
    role: project.project_members[0]!.role,
    currentRevisionId: project.current_revision_id,
    updatedAt: project.updated_at,
  }));
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
  } as unknown as Database["public"]["Functions"]["create_project"]["Args"];
  return db.rpc("create_project", args);
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

export async function getProjectForViewer(
  projectId: string,
): Promise<ProjectDetail | null> {
  const db = await createSupabaseServerClient();
  const { data: project, error } = await db
    .from("projects")
    .select(
      "id,owner_id,title,description,bpm,musical_key,time_signature_numerator,time_signature_denominator,lock_version,open_to_contributions,visibility,status,current_revision_id,published_at,created_at,updated_at,license_code,project_members(role)",
    )
    .eq("id", projectId)
    .maybeSingle();
  if (error || !project) return null;
  const [license, genres, tags] = await Promise.all([
    db
      .from("licenses")
      .select("code,name,url,summary")
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
    license: license.data,
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
    visibility: "private",
    status: project.status as ProjectDetail["status"],
    currentRevisionId: project.current_revision_id,
    publishedAt: project.published_at,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  };
}
