import "server-only";

import type {
  ContributionDetail,
  ContributionListItem,
  ContributionStatus,
} from "@/features/contributions/types";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function listContributionsByAuthor(): Promise<
  ContributionListItem[]
> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("contributions")
    .select(
      "id,project_id,title,status,base_revision_id,current_version_id,updated_at,projects(title)",
    )
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("contributions_unavailable");
  return data.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    projectTitle: row.projects.title,
    title: row.title,
    status: row.status,
    baseRevisionId: row.base_revision_id,
    currentVersionNumber: null,
    updatedAt: row.updated_at,
  }));
}

export async function listSubmittedContributionsForOwner(
  projectId: string,
): Promise<ContributionListItem[]> {
  const all = await listContributionsByAuthor();
  return all.filter(
    (item) => item.projectId === projectId && item.status !== "draft",
  );
}

export async function getContributionForViewer(
  contributionId: string,
): Promise<ContributionDetail | null> {
  const db = await createSupabaseServerClient();
  const { data: contribution, error } = await db
    .from("contributions")
    .select(
      "id,project_id,author_id,title,description,status,base_revision_id,current_version_id,submitted_at,withdrawn_at,updated_at,projects(title,owner_id,current_revision_id,license_code,licenses(code,name,url,summary))",
    )
    .eq("id", contributionId)
    .maybeSingle();
  if (error || !contribution) return null;
  const { data: versions, error: versionsError } = await db
    .from("contribution_versions")
    .select(
      "id,version_number,base_revision_id,duration_ms,attestation_version,created_at,contribution_version_tracks(track_id)",
    )
    .eq("contribution_id", contributionId)
    .order("version_number", { ascending: false });
  if (versionsError) throw new Error("contribution_versions_unavailable");
  return {
    id: contribution.id,
    projectId: contribution.project_id,
    projectTitle: contribution.projects.title,
    projectOwnerId: contribution.projects.owner_id,
    authorId: contribution.author_id,
    title: contribution.title,
    description: contribution.description,
    status: contribution.status,
    baseRevisionId: contribution.base_revision_id,
    currentProjectRevisionId: contribution.projects.current_revision_id,
    currentVersionId: contribution.current_version_id,
    license: contribution.projects.licenses,
    submittedAt: contribution.submitted_at,
    withdrawnAt: contribution.withdrawn_at,
    updatedAt: contribution.updated_at,
    versions: versions.map((version) => ({
      id: version.id,
      versionNumber: version.version_number,
      baseRevisionId: version.base_revision_id,
      durationMs: version.duration_ms,
      trackCount: version.contribution_version_tracks.length,
      attestationVersion: version.attestation_version,
      createdAt: version.created_at,
    })),
  };
}

export async function createContributionWorkspace(input: {
  projectId: string;
  requestId: string;
  expectedCurrentRevisionId: string;
  title: string;
  description: string | null;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("create_contribution_workspace", {
    p_project_id: input.projectId,
    p_request_id: input.requestId,
    p_expected_current_revision_id: input.expectedCurrentRevisionId,
    p_title: input.title,
    p_description: input.description ?? "",
  });
}

export async function submitContribution(input: {
  contributionId: string;
  requestId: string;
  expectedWorkspaceLockVersion: number;
  expectedBaseRevisionId: string;
  expectedManifestSha256: string;
  attestationVersion: string;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("submit_contribution", {
    p_contribution_id: input.contributionId,
    p_request_id: input.requestId,
    p_expected_workspace_lock_version: input.expectedWorkspaceLockVersion,
    p_expected_base_revision_id: input.expectedBaseRevisionId,
    p_expected_manifest_sha256: input.expectedManifestSha256,
    p_attestation_version: input.attestationVersion,
  });
}

export async function withdrawContribution(input: {
  contributionId: string;
  expectedStatus: ContributionStatus;
  expectedCurrentVersionId: string | null;
}) {
  const db = await createSupabaseServerClient();
  const args = {
    p_contribution_id: input.contributionId,
    p_expected_status: input.expectedStatus,
    p_expected_current_version_id: input.expectedCurrentVersionId,
  } as unknown as Database["public"]["Functions"]["withdraw_contribution"]["Args"];
  return db.rpc("withdraw_contribution", args);
}

export async function setProjectContributionsOpen(input: {
  projectId: string;
  expectedLockVersion: number;
  open: boolean;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("set_project_contributions_open", {
    p_project_id: input.projectId,
    p_expected_lock_version: input.expectedLockVersion,
    p_open: input.open,
  });
}
