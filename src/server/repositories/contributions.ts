import "server-only";

import type {
  ContributionArrangementComparison,
  ContributionDetail,
  ContributionListItem,
  ContributionReviewDecision,
  ContributionStatus,
  PatternCreatorAttribution,
} from "@/features/contributions/types";
import type { MidiPatternVersionV3 } from "@/features/midi/domain-v3";
import { diffMidiArrangementsV1 } from "@/features/midi/semantic-diff-v1";
import type { ArrangementManifestV3 } from "@/features/studio/manifest/v3";
import { parseArrangementManifestV3 } from "@/features/studio/manifest/v3";
import type { StudioPatternVersion } from "@/features/studio/midi-adapter/manifest-v3-editor";
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

const MIDI_PUBLIC_LICENSE_CODE = "cc-by-4.0" as const;

function collaborationContractError(message: string) {
  return { message, code: "PT409", details: "", hint: "" };
}

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
      arrangement_version_id: string | null;
    }
  >();
  if (currentVersionIds.length > 0) {
    const { data: versions, error: versionsError } = await db
      .from("contribution_versions")
      .select("id,version_number,duration_ms,arrangement_version_id")
      .in("id", currentVersionIds);
    if (versionsError) throw new Error("contribution_versions_unavailable");
    for (const version of versions) versionsById.set(version.id, version);
  }
  const arrangementIds = [
    ...new Set(
      [...versionsById.values()]
        .map((version) => version.arrangement_version_id)
        .filter((id): id is string => id !== null),
    ),
  ];
  const trackCounts = new Map<string, number>();
  if (arrangementIds.length > 0) {
    const { data: tracks, error: tracksError } = await db
      .from("arrangement_tracks")
      .select("arrangement_version_id")
      .in("arrangement_version_id", arrangementIds);
    if (tracksError) throw new Error("contribution_versions_unavailable");
    for (const track of tracks) {
      trackCounts.set(
        track.arrangement_version_id,
        (trackCounts.get(track.arrangement_version_id) ?? 0) + 1,
      );
    }
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
      trackCount: version?.arrangement_version_id
        ? (trackCounts.get(version.arrangement_version_id) ?? 0)
        : 0,
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
      "id,project_id,author_id,title,description,status,base_revision_id,current_version_id,submitted_at,withdrawn_at,updated_at,moderation_state",
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
        "id,version_number,base_revision_id,arrangement_version_id,duration_ms,attestation_version,created_at",
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
  const arrangementIds = versions
    .map((version) => version.arrangement_version_id)
    .filter((id): id is string => id !== null);
  const trackCounts = new Map<string, number>();
  if (arrangementIds.length > 0) {
    const { data: tracks, error: tracksError } = await db
      .from("arrangement_tracks")
      .select("arrangement_version_id")
      .in("arrangement_version_id", arrangementIds);
    if (tracksError) throw new Error("contribution_versions_unavailable");
    for (const track of tracks) {
      trackCounts.set(
        track.arrangement_version_id,
        (trackCounts.get(track.arrangement_version_id) ?? 0) + 1,
      );
    }
  }
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
    moderationState:
      contribution.moderation_state as ContributionDetail["moderationState"],
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
    versions: versions.flatMap((version) =>
      version.arrangement_version_id
        ? [
            {
              id: version.id,
              arrangementVersionId: version.arrangement_version_id,
              versionNumber: version.version_number,
              baseRevisionId: version.base_revision_id,
              durationMs: version.duration_ms,
              trackCount: trackCounts.get(version.arrangement_version_id) ?? 0,
              attestationVersion: version.attestation_version,
              createdAt: version.created_at,
            },
          ]
        : [],
    ),
  };
}

type ArrangementDiffInput = {
  manifest: ArrangementManifestV3;
  patternVersions: MidiPatternVersionV3[];
  studioPatternVersions: StudioPatternVersion[];
  patternAttributions: PatternCreatorAttribution[];
};

async function getArrangementDiffInput(
  db: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  arrangementVersionId: string,
): Promise<ArrangementDiffInput> {
  const [arrangementResult, clipsResult] = await Promise.all([
    db
      .from("arrangement_versions")
      .select("id,manifest")
      .eq("id", arrangementVersionId)
      .maybeSingle(),
    db
      .from("arrangement_clips")
      .select("midi_pattern_version_id")
      .eq("arrangement_version_id", arrangementVersionId),
  ]);
  if (arrangementResult.error || clipsResult.error || !arrangementResult.data)
    throw new Error("contribution_arrangement_unavailable");

  const manifest = parseArrangementManifestV3(arrangementResult.data.manifest);
  const patternContexts = new Map<
    string,
    { name: string; presetId: string; presetVersion: number }
  >();
  for (const track of manifest.tracks) {
    for (const clip of track.clips) {
      if (!patternContexts.has(clip.midiPatternVersionId)) {
        patternContexts.set(clip.midiPatternVersionId, {
          name: track.name,
          presetId: track.presetId,
          presetVersion: track.presetVersion,
        });
      }
    }
  }

  const patternVersionIds = [
    ...new Set(clipsResult.data.map((clip) => clip.midi_pattern_version_id)),
  ];
  if (patternVersionIds.length === 0) {
    return {
      manifest,
      patternVersions: [],
      studioPatternVersions: [],
      patternAttributions: [],
    };
  }
  const [versionsResult, notesResult] = await Promise.all([
    db.from("midi_pattern_versions").select("*").in("id", patternVersionIds),
    db
      .from("midi_pattern_notes")
      .select("*")
      .in("midi_pattern_version_id", patternVersionIds)
      .order("start_tick")
      .order("pitch")
      .order("note_id"),
  ]);
  if (versionsResult.error || notesResult.error)
    throw new Error("contribution_patterns_unavailable");
  const notesByVersion = new Map<string, typeof notesResult.data>();
  for (const note of notesResult.data) {
    const notes = notesByVersion.get(note.midi_pattern_version_id) ?? [];
    notes.push(note);
    notesByVersion.set(note.midi_pattern_version_id, notes);
  }
  const patternVersions: MidiPatternVersionV3[] = versionsResult.data.map(
    (version) => {
      if (version.ppq !== 480)
        throw new Error("contribution_patterns_unavailable");
      return {
        midiPatternVersionId: version.id,
        midiPatternId: version.midi_pattern_id,
        version: version.version_number,
        creatorId: version.creator_id,
        creatorCreditName: version.creator_credit_name,
        parentMidiPatternVersionId: version.parent_pattern_version_id,
        sourceMidiPatternVersionId: version.source_pattern_version_id,
        contentSha256: version.content_sha256,
        ppq: 480,
        durationTicks: version.duration_ticks,
        noteCount: version.note_count,
        reuseLicense:
          version.reuse_license_code === "CC-BY-4.0" &&
          version.reuse_license_version === "4.0" &&
          version.reuse_license_url ===
            "https://creativecommons.org/licenses/by/4.0/"
            ? {
                code: "CC-BY-4.0",
                version: "4.0",
                url: "https://creativecommons.org/licenses/by/4.0/",
              }
            : null,
        createdAt: version.created_at,
        notes: (notesByVersion.get(version.id) ?? []).map((note) => ({
          noteId: note.note_id,
          startTick: note.start_tick,
          durationTicks: note.duration_ticks,
          pitch: note.pitch,
          velocity: note.velocity,
        })),
      };
    },
  );
  if (patternVersions.length !== patternVersionIds.length)
    throw new Error("contribution_patterns_unavailable");
  return {
    manifest,
    patternVersions,
    studioPatternVersions: patternVersions.map((pattern) => {
      const context = patternContexts.get(pattern.midiPatternVersionId);
      if (!context) throw new Error("contribution_patterns_unavailable");
      return { ...pattern, ...context };
    }),
    patternAttributions: versionsResult.data
      .map((version) => ({
        midiPatternVersionId: version.id,
        midiPatternId: version.midi_pattern_id,
        creatorId: version.creator_id,
        creatorCreditName: version.creator_credit_name,
        parentMidiPatternVersionId: version.parent_pattern_version_id,
        sourceMidiPatternVersionId: version.source_pattern_version_id,
        reuseLicenseCode: version.reuse_license_code,
        reuseLicenseUrl: version.reuse_license_url,
      }))
      .sort((left, right) =>
        left.midiPatternVersionId.localeCompare(right.midiPatternVersionId),
      ),
  };
}

export async function getContributionArrangementComparison(input: {
  projectId: string;
  contributionId: string;
  versionId: string;
}): Promise<ContributionArrangementComparison | null> {
  const db = await createSupabaseServerClient();
  const [contributionResult, versionResult] = await Promise.all([
    db
      .from("contributions")
      .select("id,project_id")
      .eq("id", input.contributionId)
      .eq("project_id", input.projectId)
      .maybeSingle(),
    db
      .from("contribution_versions")
      .select("id,contribution_id,base_revision_id,arrangement_version_id")
      .eq("id", input.versionId)
      .eq("contribution_id", input.contributionId)
      .maybeSingle(),
  ]);
  if (contributionResult.error || versionResult.error)
    throw new Error("contribution_comparison_unavailable");
  if (!contributionResult.data || !versionResult.data?.arrangement_version_id)
    return null;
  const { data: baseRevision, error: baseError } = await db
    .from("project_revisions")
    .select("arrangement_version_id")
    .eq("id", versionResult.data.base_revision_id)
    .eq("project_id", input.projectId)
    .maybeSingle();
  if (baseError) throw new Error("contribution_comparison_unavailable");
  if (!baseRevision?.arrangement_version_id) return null;
  const [base, submitted] = await Promise.all([
    getArrangementDiffInput(db, baseRevision.arrangement_version_id),
    getArrangementDiffInput(db, versionResult.data.arrangement_version_id),
  ]);
  return {
    baseArrangementVersionId: baseRevision.arrangement_version_id,
    submittedArrangementVersionId: versionResult.data.arrangement_version_id,
    base: {
      manifest: base.manifest,
      patternVersions: base.studioPatternVersions,
    },
    submitted: {
      manifest: submitted.manifest,
      patternVersions: submitted.studioPatternVersions,
    },
    semanticDiff: diffMidiArrangementsV1(
      { manifest: base.manifest, patternVersions: base.patternVersions },
      {
        manifest: submitted.manifest,
        patternVersions: submitted.patternVersions,
      },
    ),
    patternAttributions: submitted.patternAttributions,
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
  if (input.decision === "accept") {
    const { data, error } = await db.rpc("accept_contribution_v3", {
      p_contribution_id: input.contributionId,
      p_request_id: input.requestId,
      p_expected_contribution_version_id: input.expectedCurrentVersionId,
      p_expected_project_revision_id: input.expectedProjectRevisionId,
      ...(input.note ? { p_message: input.note } : {}),
    });
    const accepted = data?.[0];
    return {
      data: accepted
        ? [
            {
              contribution_id: input.contributionId,
              contribution_version_id: input.expectedCurrentVersionId,
              requested_decision: "accept" as const,
              applied_decision: "accept" as const,
              reason: null,
              status: "accepted" as const,
              revision_id: accepted.revision_id,
              revision_number: accepted.revision_number,
              reviewed_at: accepted.created_at,
            },
          ]
        : null,
      error,
    };
  }
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
  expectedLicenseCode: typeof MIDI_PUBLIC_LICENSE_CODE;
}) {
  const db = await createSupabaseServerClient();
  const { data: memberProject, error: memberProjectError } = await db
    .from("projects")
    .select("license_code")
    .eq("id", input.projectId)
    .maybeSingle();
  if (memberProjectError)
    return {
      data: null,
      error: collaborationContractError("contribution_license_unavailable"),
    };
  const publicProject = memberProject
    ? null
    : await db
        .from("public_project_catalog")
        .select("license_code")
        .eq("project_id", input.projectId)
        .maybeSingle();
  const licenseCode =
    memberProject?.license_code ?? publicProject?.data?.license_code;
  if (
    publicProject?.error ||
    licenseCode !== MIDI_PUBLIC_LICENSE_CODE ||
    input.expectedLicenseCode !== MIDI_PUBLIC_LICENSE_CODE
  )
    return {
      data: null,
      error: collaborationContractError("contribution_license_unavailable"),
    };
  return db.rpc("create_contribution_workspace_v3", {
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
  expectedLicenseCode: typeof MIDI_PUBLIC_LICENSE_CODE;
  attestationVersion: "contributor-attestation-v1";
}) {
  const db = await createSupabaseServerClient();
  const [contributionResult, contextResult] = await Promise.all([
    db
      .from("contributions")
      .select("base_revision_id")
      .eq("id", input.contributionId)
      .maybeSingle(),
    db.rpc("get_contribution_project_context", {
      p_contribution_id: input.contributionId,
    }),
  ]);
  if (
    contributionResult.error ||
    !contributionResult.data ||
    contextResult.error ||
    !contextResult.data
  )
    return {
      data: null,
      error: collaborationContractError("contribution_unavailable"),
    };
  const contribution = contributionResult.data;
  const context = contributionProjectContextSchema.parse(contextResult.data);
  if (
    context.license.code !== MIDI_PUBLIC_LICENSE_CODE ||
    input.expectedLicenseCode !== MIDI_PUBLIC_LICENSE_CODE
  )
    return {
      data: null,
      error: collaborationContractError("contribution_license_unavailable"),
    };
  if (
    contribution.base_revision_id !== input.expectedBaseRevisionId ||
    context.currentRevisionId !== input.expectedBaseRevisionId
  )
    return {
      data: null,
      error: collaborationContractError("contribution_base_changed"),
    };
  return db.rpc("submit_contribution_v3", {
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
