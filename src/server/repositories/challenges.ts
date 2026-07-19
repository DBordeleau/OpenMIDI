import "server-only";

import { z } from "zod";
import { canonicalizeChallengeConstraintsV1 } from "@/features/challenges/constraint-v1";
import {
  challengeEntryCommandResponseSchema,
  challengePreflightSchema,
  challengeRevisionOptionSchema,
  myChallengeEntrySchema,
  publicChallengeAwardTargetSchema,
  publicChallengeEntryPageSchema,
  publicChallengeEntrySchema,
  type PublicChallengeEntryCursor,
} from "@/features/challenges/entry-contract";
import {
  challengePhaseSchema,
  challengeStateSchema,
} from "@/features/challenges/lifecycle";
import type {
  Challenge,
  ChallengeResult,
  FeaturedChallenge,
} from "@/features/challenges/types";
import { midiArrangementPreviewSchema } from "@/features/public-midi/contract";
import type { Json } from "@/lib/supabase/database.types";
import { createSupabaseAnonymousClient } from "@/lib/supabase/anonymous";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const judgeSchema = z.object({
  position: z.number().int().positive(),
  role: z.enum(["host", "judge"]),
  displayName: z.string(),
  profileId: z.uuid().nullable(),
  creditName: z.string(),
});

const resultAttributionSchema = z.object({
  kind: z.enum(["publisher", "accepted_contributor"]),
  creditName: z.string(),
});

const challengeResultSchema: z.ZodType<ChallengeResult> = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  finalizedAt: z.string(),
  note: z.string(),
  entries: z.array(
    z.object({
      entryId: z.uuid(),
      projectTitle: z.string(),
      entrantUsername: z.string(),
      entrantDisplayName: z.string(),
      entrantCreditName: z.string(),
      revisionNumber: z.number().int().positive(),
      revisionMessage: z.string().nullable(),
      attributions: z.array(resultAttributionSchema),
      durationMs: z.number().int().nonnegative(),
      submittedAt: z.string(),
      voteTotal: z.number().int().nonnegative(),
    }),
  ),
  placements: z.array(
    z.object({
      place: z.number().int().positive(),
      label: z.string(),
      entryId: z.uuid(),
      projectTitle: z.string(),
      entrantUsername: z.string(),
      entrantCreditName: z.string(),
    }),
  ),
  communityFavorites: z.array(
    z.object({
      entryId: z.uuid(),
      projectTitle: z.string(),
      entrantUsername: z.string(),
      entrantCreditName: z.string(),
      voteTotal: z.number().int().nonnegative(),
    }),
  ),
  supersedesResultId: z.uuid().nullable(),
  correctionReason: z.string().nullable(),
});

const challengeSchema: z.ZodType<Challenge> = z.object({
  id: z.uuid(),
  slug: z.string(),
  state: challengeStateSchema,
  phase: challengePhaseSchema,
  acceptsVotes: z.boolean(),
  lifecycleVersion: z.number().int().positive(),
  currentVersionId: z.uuid(),
  versionNumber: z.number().int().positive(),
  title: z.string(),
  prompt: z.string(),
  description: z.string(),
  eligibilityTerms: z.string(),
  presentationCode: z.enum(["pulse", "nocturne", "sunrise"]),
  opensAt: z.string(),
  submissionsCloseAt: z.string(),
  votingOpensAt: z.string(),
  votingClosesAt: z.string(),
  resultsExpectedAt: z.string(),
  judgingMode: z.enum(["community", "judged", "hybrid"]),
  officialPlacementCount: z.number().int().min(0).max(20),
  constraints: z.unknown().transform(canonicalizeChallengeConstraintsV1),
  constraintsSha256: z.string().regex(/^[0-9a-f]{64}$/),
  judges: z.array(judgeSchema),
  starter: z
    .object({
      projectId: z.uuid(),
      revisionId: z.uuid(),
      projectTitle: z.string(),
      creatorCreditName: z.string(),
      revisionNumber: z.number().int().positive(),
      licenseCode: z.string(),
      available: z.boolean(),
    })
    .nullable(),
  publishedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  cancellationNote: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  moderationState: z.enum(["visible", "hidden"]).nullable(),
  moderationVersion: z.number().int().positive().nullable(),
  currentResultId: z.uuid().nullable(),
  result: challengeResultSchema.nullable(),
});

const featuredChallengeSchema: z.ZodType<FeaturedChallenge> = z.object({
  selectionKind: z.enum([
    "selected",
    "next_scheduled",
    "active",
    "recent_completed",
  ]),
  label: z.string(),
  challenge: challengeSchema,
});

const commandResultSchema = z.object({
  challengeId: z.uuid(),
  versionId: z.uuid(),
  lifecycleVersion: z.number().int().positive(),
});

export type ChallengeVersionCommandInput = {
  title: string;
  prompt: string;
  description: string;
  eligibilityTerms: string;
  presentationCode: "pulse" | "nocturne" | "sunrise";
  opensAt: string;
  submissionsCloseAt: string;
  votingOpensAt: string;
  votingClosesAt: string;
  resultsExpectedAt: string;
  judgingMode: "community" | "judged" | "hybrid";
  officialPlacementCount: number;
  starterProjectId: string | null;
  starterRevisionId: string | null;
  constraints: Json;
};

export type ChallengeJudgeCommandInput = {
  role: "host" | "judge";
  displayName: string;
  profileId: string | null;
};

export async function createChallengeDraft(input: {
  requestId: string;
  slug: string;
  version: ChallengeVersionCommandInput;
  judges: ChallengeJudgeCommandInput[];
}) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("create_challenge_draft", {
    p_request_id: input.requestId,
    p_slug: input.slug,
    p_version: input.version,
    p_judges: input.judges,
  });
  return { data: data ? commandResultSchema.parse(data) : null, error };
}

export async function reviseChallengeDraft(input: {
  challengeId: string;
  requestId: string;
  expectedLifecycleVersion: number;
  expectedCurrentVersionId: string;
  version: ChallengeVersionCommandInput;
  judges: ChallengeJudgeCommandInput[];
}) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("revise_challenge_draft", {
    p_challenge_id: input.challengeId,
    p_request_id: input.requestId,
    p_expected_lifecycle_version: input.expectedLifecycleVersion,
    p_expected_current_version_id: input.expectedCurrentVersionId,
    p_version: input.version,
    p_judges: input.judges,
  });
  return { data: data ? commandResultSchema.parse(data) : null, error };
}

export async function mutateChallengeLifecycle(input: {
  action: "publish" | "cancel";
  challengeId: string;
  requestId: string;
  expectedLifecycleVersion: number;
  expectedCurrentVersionId: string;
  reason: string;
}) {
  const db = await createSupabaseServerClient();
  const result =
    input.action === "publish"
      ? await db.rpc("publish_challenge", {
          p_challenge_id: input.challengeId,
          p_request_id: input.requestId,
          p_expected_lifecycle_version: input.expectedLifecycleVersion,
          p_expected_current_version_id: input.expectedCurrentVersionId,
        })
      : await db.rpc("cancel_challenge", {
          p_challenge_id: input.challengeId,
          p_request_id: input.requestId,
          p_expected_lifecycle_version: input.expectedLifecycleVersion,
          p_expected_current_version_id: input.expectedCurrentVersionId,
          p_reason: input.reason,
        });
  return {
    data: result.data ? commandResultSchema.parse(result.data) : null,
    error: result.error,
  };
}

export async function listAdminChallenges() {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("list_admin_challenges");
  if (error) throw new Error("admin_challenges_unavailable");
  return z.array(challengeSchema).parse(data);
}

export async function getAdminChallenge(challengeId: string) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("get_admin_challenge", {
    p_challenge_id: challengeId,
  });
  if (error || !data) return null;
  return challengeSchema.parse(data);
}

export async function listPublicChallenges() {
  const db = createSupabaseAnonymousClient();
  const { data, error } = await db.rpc("list_public_challenges");
  if (error) throw new Error("public_challenges_unavailable");
  return z.array(challengeSchema).parse(data);
}

export async function getPublicChallenge(slug: string) {
  const db = createSupabaseAnonymousClient();
  const { data, error } = await db.rpc("get_public_challenge", {
    p_slug: slug,
  });
  if (error || !data) return null;
  return challengeSchema.parse(data);
}

export async function getPublicChallengeAwardTarget(
  slug: string,
  resultId: string,
  entryId: string,
) {
  const db = createSupabaseAnonymousClient();
  const { data, error } = await db.rpc("get_public_challenge_award_target", {
    p_slug: slug,
    p_result_id: resultId,
    p_entry_id: entryId,
  });
  if (error || !data) return null;
  return publicChallengeAwardTargetSchema.parse(data);
}

export async function listEligibleChallengeStarters() {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("public_project_catalog")
    .select(
      "project_id,current_revision_id,title,revision_number,license_code,license_allows_derivatives",
    )
    .eq("license_code", "cc-by-4.0")
    .eq("license_allows_derivatives", true)
    .order("published_at", { ascending: false })
    .limit(25);
  if (error) throw new Error("challenge_starters_unavailable");
  return data.map((row) => ({
    projectId: row.project_id,
    revisionId: row.current_revision_id,
    title: row.title,
    revisionNumber: row.revision_number,
  }));
}

export async function listMyChallengeRevisionOptions(challengeId: string) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("list_my_challenge_revision_options", {
    p_challenge_id: challengeId,
  });
  if (error || !data) return [];
  return z.array(challengeRevisionOptionSchema).parse(data);
}

export async function preflightChallengeRevision(input: {
  challengeId: string;
  challengeVersionId: string;
  revisionId: string;
}) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("preflight_challenge_revision", {
    p_challenge_id: input.challengeId,
    p_challenge_version_id: input.challengeVersionId,
    p_revision_id: input.revisionId,
  });
  return {
    data: data ? challengePreflightSchema.parse(data) : null,
    error,
  };
}

export async function submitChallengeEntry(input: {
  challengeId: string;
  challengeVersionId: string;
  revisionId: string;
  requestId: string;
  expectedActiveEntryId: string | null;
  displayAttestationVersion: string;
}) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("submit_challenge_entry", {
    p_challenge_id: input.challengeId,
    p_challenge_version_id: input.challengeVersionId,
    p_project_revision_id: input.revisionId,
    p_request_id: input.requestId,
    // Postgres accepts SQL null for the first-entry sentinel; generated RPC
    // argument types cannot express nullable function parameters.
    p_expected_active_entry_id: input.expectedActiveEntryId!,
    p_display_attestation_version: input.displayAttestationVersion,
  });
  return {
    data: data ? challengeEntryCommandResponseSchema.parse(data) : null,
    error,
  };
}

export async function getMyChallengeEntry(challengeId: string) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("get_my_challenge_entry", {
    p_challenge_id: challengeId,
  });
  if (error || !data) return null;
  return myChallengeEntrySchema.parse(data);
}

export async function listPublicChallengeEntries(
  slug: string,
  cursor: PublicChallengeEntryCursor | null = null,
) {
  const db = createSupabaseAnonymousClient();
  const { data, error } = await db.rpc("list_public_challenge_entries", {
    p_slug: slug,
    ...(cursor
      ? {
          p_rotation_bucket: cursor.rotationBucket,
          p_after_rotation_key: cursor.rotationKey,
          p_after_entry_id: cursor.entryId,
        }
      : {}),
  });
  if (error) throw new Error("challenge_entries_unavailable");
  return publicChallengeEntryPageSchema.parse(data);
}

export async function getPublicChallengeEntry(slug: string, entryId: string) {
  const db = createSupabaseAnonymousClient();
  const { data, error } = await db.rpc("get_public_challenge_entry", {
    p_slug: slug,
    p_entry_id: entryId,
  });
  if (error || !data) return null;
  return publicChallengeEntrySchema.parse(data);
}

export async function getPublicChallengeEntryPreview(
  slug: string,
  entryId: string,
) {
  const db = createSupabaseAnonymousClient();
  const { data, error } = await db.rpc("get_public_challenge_entry_preview", {
    p_slug: slug,
    p_entry_id: entryId,
  });
  if (error || !data) return null;
  return midiArrangementPreviewSchema.parse(data);
}

const voteCommandSchema = z.union([
  z.object({
    entryId: z.uuid(),
    active: z.boolean(),
    voteVersion: z.number().int().positive(),
  }),
  z.object({ errorCode: z.string().regex(/^PT[0-9]{3}$/) }),
]);

export async function setChallengeVote(input: {
  entryId: string;
  active: boolean;
  requestId: string;
}) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("set_challenge_vote", {
    p_entry_id: input.entryId,
    p_active: input.active,
    p_request_id: input.requestId,
  });
  return { data: data ? voteCommandSchema.parse(data) : null, error };
}

export async function listMyActiveChallengeVoteIds(challengeId: string) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("list_my_active_challenge_vote_ids", {
    p_challenge_id: challengeId,
  });
  if (error || !data) return [];
  return z.array(z.uuid()).parse(data);
}

export async function reportChallengeContent(input: {
  requestId: string;
  targetKind: "challenge" | "entry";
  challengeId: string;
  entryId: string | null;
  reason:
    "spam" | "harassment" | "rights_concern" | "vote_manipulation" | "other";
  details: string | null;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("report_challenge_content", {
    p_request_id: input.requestId,
    p_target_kind: input.targetKind,
    p_challenge_id: input.challengeId,
    p_entry_id: input.entryId!,
    p_reason: input.reason,
    p_details: input.details!,
  });
}

export async function moderateChallengeTarget(input: {
  requestId: string;
  challengeId: string;
  entryId: string | null;
  voteId: string | null;
  action:
    | "challenge_hide"
    | "challenge_restore"
    | "entry_hide"
    | "entry_restore"
    | "entry_disqualify"
    | "vote_exclude"
    | "vote_restore";
  expectedVersion: number;
  reason: string;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("moderate_challenge_target", {
    p_request_id: input.requestId,
    p_challenge_id: input.challengeId,
    p_entry_id: input.entryId!,
    p_vote_id: input.voteId!,
    p_action: input.action,
    p_expected_version: input.expectedVersion,
    p_reason: input.reason,
  });
}

const adminResultsSchema = z.object({
  challenge: challengeSchema,
  results: z.array(challengeResultSchema),
  entries: z.array(
    z.object({
      entryId: z.uuid(),
      projectTitle: z.string(),
      entrantUsername: z.string(),
      status: z.enum(["active", "replaced", "withdrawn", "disqualified"]),
      moderationState: z.enum(["visible", "hidden"]),
      moderationVersion: z.number().int().positive(),
      voteTotal: z.number().int().nonnegative(),
    }),
  ),
  votes: z.array(
    z.object({
      voteId: z.uuid(),
      entryId: z.uuid(),
      voterId: z.uuid(),
      state: z.enum(["active", "removed", "excluded"]),
      voteVersion: z.number().int().positive(),
      updatedAt: z.string(),
    }),
  ),
  reports: z.array(
    z.object({
      reportId: z.uuid(),
      targetKind: z.enum(["challenge", "entry"]),
      entryId: z.uuid().nullable(),
      targetLabel: z.string(),
      reason: z.enum([
        "spam",
        "harassment",
        "rights_concern",
        "vote_manipulation",
        "other",
      ]),
      details: z.string().max(1000).nullable(),
      createdAt: z.string(),
    }),
  ),
  reportCount: z.number().int().nonnegative(),
  featuredSelection: z.object({
    challengeId: z.uuid().nullable(),
    version: z.number().int().nonnegative(),
  }),
});

export type AdminChallengeResults = z.infer<typeof adminResultsSchema>;

export async function getAdminChallengeResults(challengeId: string) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("get_admin_challenge_results", {
    p_challenge_id: challengeId,
  });
  if (error || !data) return null;
  return adminResultsSchema.parse(data);
}

export async function finalizeChallengeResult(input: {
  challengeId: string;
  requestId: string;
  expectedLifecycleVersion: number;
  expectedCurrentVersionId: string;
  expectedCurrentResultId: string | null;
  publicNote: string;
  placements: Array<{ entryId: string; place: number; label: string }>;
  correctionReason: string | null;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("finalize_challenge_result", {
    p_challenge_id: input.challengeId,
    p_request_id: input.requestId,
    p_expected_lifecycle_version: input.expectedLifecycleVersion,
    p_expected_current_version_id: input.expectedCurrentVersionId,
    p_expected_current_result_id: input.expectedCurrentResultId!,
    p_public_note: input.publicNote,
    p_placements: input.placements,
    p_correction_reason: input.correctionReason!,
  });
}

export async function setFeaturedChallenge(input: {
  requestId: string;
  challengeId: string | null;
  expectedVersion: number;
}) {
  const db = await createSupabaseServerClient();
  return input.challengeId
    ? db.rpc("set_featured_challenge", {
        p_request_id: input.requestId,
        p_challenge_id: input.challengeId,
        p_expected_version: input.expectedVersion,
      })
    : db.rpc("clear_featured_challenge", {
        p_request_id: input.requestId,
        p_expected_version: input.expectedVersion,
      });
}

export async function getFeaturedChallenge() {
  const db = createSupabaseAnonymousClient();
  const { data, error } = await db.rpc("get_featured_challenge");
  if (error || !data) return null;
  return featuredChallengeSchema.parse(data);
}
