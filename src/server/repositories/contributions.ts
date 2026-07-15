import "server-only";

import type {
  ContributionDetail,
  ContributionListItem,
  ContributionReviewDecision,
  ContributionStatus,
} from "@/features/contributions/types";
import {
  parseAnyWorkspaceManifest,
  STUDIO_ENGINE_VERSION,
} from "@/features/studio/manifest/schema";
import { COMPOSITE_STUDIO_ENGINE_VERSION } from "@/features/studio/manifest/v2";
import type { RevisionPlayback } from "@/server/repositories/revisions";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";
import {
  decodeNavigationCursor,
  encodeNavigationCursor,
} from "@/features/navigation/cursor";

const contributionProjectContextSchema = z.object({
  title: z.string(),
  ownerId: z.string().uuid(),
  currentRevisionId: z.string().uuid().nullable(),
  currentRevisionNumber: z.number().int().positive().nullable(),
  baseRevisionNumber: z.number().int().positive(),
  license: z.object({
    code: z.string(),
    name: z.string(),
    url: z.string(),
    summary: z.string(),
  }),
});

export async function listContributionsByAuthor(
  viewerId: string,
  options: { status?: "active" | "submitted" | "history"; after?: string } = {},
) {
  const status = options.status ?? "active";
  const cursor = decodeNavigationCursor(options.after);
  if (
    options.after &&
    (!cursor ||
      cursor.kind !== "contributions" ||
      cursor.subject !== viewerId ||
      cursor.filter !== status)
  )
    throw new Error("contributions_cursor_invalid");
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("list_viewer_contributions", {
    p_status: status,
    p_after_updated_at: cursor?.timestamp,
    p_after_id: cursor?.id,
  });
  if (error) throw new Error("contributions_unavailable");
  const rows = z
    .array(
      z.object({
        contribution_id: z.string().uuid(),
        project_id: z.string().uuid(),
        project_title: z.string(),
        title: z.string(),
        status: z.enum([
          "draft",
          "submitted",
          "changes_requested",
          "accepted",
          "rejected",
          "withdrawn",
        ]),
        base_revision_id: z.string().uuid(),
        current_version_number: z.number().int().positive().nullable(),
        updated_at: z.string(),
      }),
    )
    .parse(data);
  const visible = rows.slice(0, 24);
  const contributions: ContributionListItem[] = visible.map((row) => ({
    id: row.contribution_id,
    projectId: row.project_id,
    projectTitle: row.project_title,
    title: row.title,
    status: row.status,
    baseRevisionId: row.base_revision_id,
    currentVersionNumber: row.current_version_number,
    updatedAt: row.updated_at,
  }));
  const last = rows.length > 24 ? visible.at(-1) : null;
  return {
    contributions,
    nextCursor: last
      ? encodeNavigationCursor({
          v: 1,
          kind: "contributions",
          subject: viewerId,
          filter: status,
          timestamp: last.updated_at,
          id: last.contribution_id,
        })
      : null,
  };
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
      "id,project_id,author_id,title,description,status,base_revision_id,current_version_id,submitted_at,withdrawn_at,updated_at",
    )
    .eq("id", contributionId)
    .maybeSingle();
  if (error || !contribution) return null;
  const { data: rawContext, error: contextError } = await db.rpc(
    "get_contribution_project_context",
    { p_contribution_id: contributionId },
  );
  if (contextError || !rawContext) return null;
  const context = contributionProjectContextSchema.parse(rawContext);
  const [
    { data: versions, error: versionsError },
    reviewsResult,
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
      .eq("accepted_contribution_id", contributionId)
      .maybeSingle(),
  ]);
  if (versionsError) throw new Error("contribution_versions_unavailable");
  if (reviewsResult.error || acceptedResult.error)
    throw new Error("contribution_review_unavailable");
  return {
    id: contribution.id,
    projectId: contribution.project_id,
    projectTitle: context.title,
    projectOwnerId: context.ownerId,
    authorId: contribution.author_id,
    title: contribution.title,
    description: contribution.description,
    status: contribution.status,
    baseRevisionId: contribution.base_revision_id,
    currentProjectRevisionId: context.currentRevisionId,
    baseRevisionNumber: context.baseRevisionNumber,
    currentProjectRevisionNumber: context.currentRevisionNumber,
    currentVersionId: contribution.current_version_id,
    acceptedRevisionId: acceptedResult.data?.id ?? null,
    acceptedRevisionNumber: acceptedResult.data?.revision_number ?? null,
    license: context.license,
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
      "id,contribution_id,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,contributions!contribution_versions_contribution_id_fkey(project_id),contribution_version_tracks(track_id,kind,asset_id,name,duration_ms,sort_order,preset_id,preset_version,instruments(name),assets(duration_ms,asset_credits(credit_name,role,position,profiles!asset_credits_user_id_fkey(username))),contribution_version_clips(clip_id,kind,position_ms,trim_start_ms,duration_ms,midi_stem_version_id,start_tick,duration_ticks,source_start_tick,loop),contribution_version_midi_track_credits(credited_stem_version_id,creator_credit_name,credit_role,profiles!contribution_version_midi_track_credits_creator_id_fkey(username)))",
    )
    .eq("id", input.versionId)
    .eq("contribution_id", input.contributionId)
    .maybeSingle();
  if (error) throw new Error("contribution_version_unavailable");
  if (!data || data.contributions.project_id !== input.projectId) return null;
  const v1 =
    data.manifest_version === 1 &&
    data.engine === "waveform-playlist" &&
    data.engine_version === STUDIO_ENGINE_VERSION;
  const v2 =
    data.manifest_version === 2 &&
    data.engine === "jam-session-composite" &&
    data.engine_version === COMPOSITE_STUDIO_ENGINE_VERSION;
  if (!v1 && !v2) throw new Error("contribution_version_invalid");
  const manifest = parseAnyWorkspaceManifest(data.manifest);
  const tracks = [...data.contribution_version_tracks].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  if (
    (manifest.manifestVersion === 1
      ? manifest.workspaceId !== input.projectId
      : manifest.projectId !== input.projectId) ||
    tracks.length !== manifest.tracks.length ||
    tracks.some((track, index) => {
      const item = manifest.tracks[index];
      if (manifest.manifestVersion === 1)
        return (
          !item ||
          !("positionMs" in item) ||
          item.trackId !== track.track_id ||
          item.assetId !== track.asset_id ||
          item.name !== track.name ||
          item.durationMs !== track.duration_ms ||
          item.sortOrder !== track.sort_order ||
          track.assets?.duration_ms === null
        );
      return (
        !item ||
        !("kind" in item) ||
        item.trackId !== track.track_id ||
        item.kind !== track.kind ||
        item.name !== track.name ||
        item.sortOrder !== track.sort_order ||
        (item.kind === "audio"
          ? item.assetId !== track.asset_id
          : item.presetId !== track.preset_id ||
            item.presetVersion !== track.preset_version) ||
        item.clips.length !== track.contribution_version_clips.length
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
      kind: track.kind as "audio" | "midi",
      assetId: track.asset_id,
      displayName: track.name,
      verifiedDurationMs: track.assets?.duration_ms ?? track.duration_ms ?? 0,
      instrumentName: track.instruments?.name ?? null,
      credits:
        track.kind === "midi"
          ? [...track.contribution_version_midi_track_credits]
              .sort(
                (a, b) =>
                  a.credit_role.localeCompare(b.credit_role) ||
                  a.creator_credit_name.localeCompare(b.creator_credit_name),
              )
              .map((credit, position) => ({
                creditName: credit.creator_credit_name,
                role:
                  credit.credit_role === "derivation_source"
                    ? ("derivation" as const)
                    : ("creator" as const),
                position,
                profileUsername: credit.profiles?.username ?? null,
              }))
          : [...(track.assets?.asset_credits ?? [])]
              .sort((a, b) => a.position - b.position)
              .map((credit) => ({
                creditName: credit.credit_name,
                role: credit.role,
                position: credit.position,
                profileUsername: credit.profiles?.username ?? null,
              })),
      creditName:
        track.assets?.asset_credits.find((credit) => credit.position === 0)
          ?.credit_name ??
        track.contribution_version_midi_track_credits.find(
          (credit) => credit.credit_role === "creator",
        )?.creator_credit_name ??
        "Unknown creator",
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
