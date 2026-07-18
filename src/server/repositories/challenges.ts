import "server-only";

import { z } from "zod";
import { canonicalizeChallengeConstraintsV1 } from "@/features/challenges/constraint-v1";
import {
  challengeEntryCommandResponseSchema,
  challengePreflightSchema,
  challengeRevisionOptionSchema,
  myChallengeEntrySchema,
  publicChallengeEntrySchema,
} from "@/features/challenges/entry-contract";
import {
  challengePhaseSchema,
  challengeStateSchema,
} from "@/features/challenges/lifecycle";
import type { Challenge } from "@/features/challenges/types";
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

const challengeSchema: z.ZodType<Challenge> = z.object({
  id: z.uuid(),
  slug: z.string(),
  state: challengeStateSchema,
  phase: challengePhaseSchema,
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
  cancelledAt: z.string().nullable(),
  cancellationNote: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
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

export async function listPublicChallengeEntries(slug: string) {
  const db = createSupabaseAnonymousClient();
  const { data, error } = await db.rpc("list_public_challenge_entries", {
    p_slug: slug,
  });
  if (error) throw new Error("challenge_entries_unavailable");
  return z.array(publicChallengeEntrySchema).parse(data);
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
