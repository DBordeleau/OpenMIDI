import "server-only";

import type {
  ContributionDetail,
  ContributionListItem,
  ContributionReviewDecision,
  ContributionStatus,
} from "@/features/contributions/types";
import {
  parseVersionedWorkspaceManifest,
  STUDIO_ENGINE_VERSION,
} from "@/features/studio/manifest/schema";
import type { RevisionPlayback } from "@/server/repositories/revisions";
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

export async function listContributionsForOwnerReview(
  projectId: string,
): Promise<ContributionListItem[]> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("contributions")
    .select(
      "id,project_id,title,status,base_revision_id,current_version_id,submitted_at,updated_at,projects(title,current_revision_id)",
    )
    .eq("project_id", projectId)
    .neq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("contributions_unavailable");
  const currentVersionIds = data
    .map((row) => row.current_version_id)
    .filter((id): id is string => Boolean(id));
  const versionsById = new Map<
    string,
    {
      id: string;
      version_number: number;
      duration_ms: number;
      contribution_version_tracks: { track_id: string }[];
    }
  >();
  if (currentVersionIds.length > 0) {
    const { data: versions, error: versionsError } = await db
      .from("contribution_versions")
      .select(
        "id,version_number,duration_ms,contribution_version_tracks(track_id)",
      )
      .in("id", currentVersionIds);
    if (versionsError) throw new Error("contribution_versions_unavailable");
    for (const version of versions) versionsById.set(version.id, version);
  }
  const revisionIds = [
    ...new Set(
      data
        .flatMap((row) => [
          row.base_revision_id,
          row.projects.current_revision_id,
        ])
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: revisions } = await db
    .from("project_revisions")
    .select("id,revision_number")
    .in("id", revisionIds);
  const revisionNumbers = new Map(
    (revisions ?? []).map((revision) => [
      revision.id,
      revision.revision_number,
    ]),
  );
  return data.map((row) => {
    const version = row.current_version_id
      ? versionsById.get(row.current_version_id)
      : null;
    return {
      id: row.id,
      projectId: row.project_id,
      projectTitle: row.projects.title,
      title: row.title,
      status: row.status,
      baseRevisionId: row.base_revision_id,
      currentVersionNumber: version?.version_number ?? null,
      trackCount: version?.contribution_version_tracks.length ?? 0,
      durationMs: version?.duration_ms ?? 0,
      submittedAt: row.submitted_at,
      baseRevisionNumber: revisionNumbers.get(row.base_revision_id) ?? null,
      currentRevisionNumber: row.projects.current_revision_id
        ? (revisionNumbers.get(row.projects.current_revision_id) ?? null)
        : null,
      isStale: row.base_revision_id !== row.projects.current_revision_id,
      updatedAt: row.updated_at,
    };
  });
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
  const [
    { data: versions, error: versionsError },
    reviewsResult,
    revisionsResult,
    acceptedResult,
  ] = await Promise.all([
    db
      .from("contribution_versions")
      .select(
        "id,version_number,base_revision_id,duration_ms,attestation_version,created_at,contribution_version_tracks(track_id)",
      )
      .eq("contribution_id", contributionId)
      .order("version_number", { ascending: false }),
    db
      .from("contribution_reviews")
      .select(
        "id,contribution_version_id,requested_decision,applied_decision,reason,note,resulting_revision_id,created_at",
      )
      .eq("contribution_id", contributionId)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("project_revisions")
      .select("id,revision_number")
      .in(
        "id",
        [
          contribution.base_revision_id,
          contribution.projects.current_revision_id,
        ].filter((id): id is string => Boolean(id)),
      ),
    db
      .from("project_revisions")
      .select("id,revision_number")
      .eq("accepted_contribution_id", contributionId)
      .maybeSingle(),
  ]);
  if (versionsError) throw new Error("contribution_versions_unavailable");
  if (reviewsResult.error || revisionsResult.error || acceptedResult.error)
    throw new Error("contribution_review_unavailable");
  const revisionNumbers = new Map(
    revisionsResult.data.map((revision) => [
      revision.id,
      revision.revision_number,
    ]),
  );
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
    baseRevisionNumber: revisionNumbers.get(contribution.base_revision_id)!,
    currentProjectRevisionNumber: contribution.projects.current_revision_id
      ? (revisionNumbers.get(contribution.projects.current_revision_id) ?? null)
      : null,
    currentVersionId: contribution.current_version_id,
    acceptedRevisionId: acceptedResult.data?.id ?? null,
    acceptedRevisionNumber: acceptedResult.data?.revision_number ?? null,
    license: contribution.projects.licenses,
    submittedAt: contribution.submitted_at,
    withdrawnAt: contribution.withdrawn_at,
    updatedAt: contribution.updated_at,
    reviews: reviewsResult.data.map((review) => ({
      id: review.id,
      versionId: review.contribution_version_id,
      requestedDecision: review.requested_decision,
      appliedDecision: review.applied_decision,
      reason: review.reason,
      note: review.note,
      resultingRevisionId: review.resulting_revision_id,
      createdAt: review.created_at,
    })),
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

export async function getContributionVersionPlayback(input: {
  projectId: string;
  contributionId: string;
  versionId: string;
}): Promise<RevisionPlayback | null> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("contribution_versions")
    .select(
      "id,contribution_id,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,contributions(project_id),contribution_version_tracks(track_id,asset_id,name,duration_ms,sort_order,instruments(name),assets(duration_ms,asset_credits(credit_name,role,position,profiles!asset_credits_user_id_fkey(username))))",
    )
    .eq("id", input.versionId)
    .eq("contribution_id", input.contributionId)
    .maybeSingle();
  if (error) throw new Error("contribution_version_unavailable");
  if (!data || data.contributions.project_id !== input.projectId) return null;
  if (
    data.manifest_version !== 1 ||
    data.engine !== "waveform-playlist" ||
    data.engine_version !== STUDIO_ENGINE_VERSION
  )
    throw new Error("contribution_version_invalid");
  const manifest = parseVersionedWorkspaceManifest(data.manifest);
  const tracks = [...data.contribution_version_tracks].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  if (
    manifest.workspaceId !== input.projectId ||
    tracks.length !== manifest.tracks.length ||
    tracks.some((track, index) => {
      const item = manifest.tracks[index];
      return (
        !item ||
        item.trackId !== track.track_id ||
        item.assetId !== track.asset_id ||
        item.name !== track.name ||
        item.durationMs !== track.duration_ms ||
        item.sortOrder !== track.sort_order ||
        track.assets.duration_ms === null
      );
    })
  )
    throw new Error("contribution_version_invalid");
  return {
    projectId: input.projectId,
    revisionId: data.id,
    revisionNumber: 0,
    manifest,
    manifestSha256: data.manifest_sha256,
    durationMs: data.duration_ms,
    tracks: tracks.map((track) => ({
      trackId: track.track_id,
      assetId: track.asset_id,
      displayName: track.name,
      verifiedDurationMs: track.assets.duration_ms!,
      instrumentName: track.instruments?.name ?? null,
      credits: [...track.assets.asset_credits]
        .sort((a, b) => a.position - b.position)
        .map((credit) => ({
          creditName: credit.credit_name,
          role: credit.role,
          position: credit.position,
          profileUsername: credit.profiles?.username ?? null,
        })),
      creditName: track.assets.asset_credits.find(
        (credit) => credit.position === 0,
      )!.credit_name,
    })),
  };
}

export async function reviewContribution(input: {
  contributionId: string;
  requestId: string;
  decision: ContributionReviewDecision;
  expectedStatus: "submitted";
  expectedCurrentVersionId: string;
  expectedProjectRevisionId: string;
  note: string | null;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("review_contribution", {
    p_contribution_id: input.contributionId,
    p_request_id: input.requestId,
    p_decision: input.decision,
    p_expected_status: input.expectedStatus,
    p_expected_current_version_id: input.expectedCurrentVersionId,
    p_expected_project_revision_id: input.expectedProjectRevisionId,
    p_note: input.note ?? undefined,
  });
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
