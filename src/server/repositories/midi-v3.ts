import "server-only";

import type { Database, Json } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PatternVersionRow =
  Database["public"]["Tables"]["midi_pattern_versions"]["Row"];
type PatternNoteRow = Database["public"]["Tables"]["midi_pattern_notes"]["Row"];
type ArrangementRow =
  Database["public"]["Tables"]["arrangement_versions"]["Row"];
type ArrangementTrackRow =
  Database["public"]["Tables"]["arrangement_tracks"]["Row"];
type ArrangementClipRow =
  Database["public"]["Tables"]["arrangement_clips"]["Row"];

export type MidiPatternVersionRecord = PatternVersionRow & {
  notes: PatternNoteRow[];
};

export type ArrangementTrackRecord = ArrangementTrackRow & {
  clips: ArrangementClipRow[];
};

export type ArrangementVersionRecord = ArrangementRow & {
  tracks: ArrangementTrackRecord[];
};

function firstRpcRow<T>(
  data: T[] | null,
  error: { message: string } | null,
  code: string,
): T {
  if (error || !data?.[0]) throw new Error(code);
  return data[0];
}

export async function getMidiPatternVersionV3(
  patternVersionId: string,
): Promise<MidiPatternVersionRecord | null> {
  const db = await createSupabaseServerClient();
  const [version, notes] = await Promise.all([
    db
      .from("midi_pattern_versions")
      .select("*")
      .eq("id", patternVersionId)
      .maybeSingle(),
    db
      .from("midi_pattern_notes")
      .select("*")
      .eq("midi_pattern_version_id", patternVersionId)
      .order("start_tick")
      .order("pitch")
      .order("note_id"),
  ]);
  if (version.error || notes.error)
    throw new Error("midi_pattern_version_unavailable");
  if (!version.data) return null;
  return { ...version.data, notes: notes.data };
}

export async function getArrangementVersionV3(
  arrangementVersionId: string,
): Promise<ArrangementVersionRecord | null> {
  const db = await createSupabaseServerClient();
  const [arrangement, tracks, clips] = await Promise.all([
    db
      .from("arrangement_versions")
      .select("*")
      .eq("id", arrangementVersionId)
      .maybeSingle(),
    db
      .from("arrangement_tracks")
      .select("*")
      .eq("arrangement_version_id", arrangementVersionId)
      .order("sort_order"),
    db
      .from("arrangement_clips")
      .select("*")
      .eq("arrangement_version_id", arrangementVersionId)
      .order("start_tick")
      .order("clip_id"),
  ]);
  if (arrangement.error || tracks.error || clips.error)
    throw new Error("arrangement_version_unavailable");
  if (!arrangement.data) return null;
  const clipsByTrack = new Map<string, ArrangementClipRow[]>();
  for (const clip of clips.data) {
    const grouped = clipsByTrack.get(clip.track_id) ?? [];
    grouped.push(clip);
    clipsByTrack.set(clip.track_id, grouped);
  }
  return {
    ...arrangement.data,
    tracks: tracks.data.map((track) => ({
      ...track,
      clips: clipsByTrack.get(track.track_id) ?? [],
    })),
  };
}

export async function createMidiPatternV3(input: {
  requestId: string;
  name: string;
  sourcePatternVersionId?: string;
}) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("create_midi_pattern_v3", {
    p_request_id: input.requestId,
    p_name: input.name,
    ...(input.sourcePatternVersionId
      ? { p_source_pattern_version_id: input.sourcePatternVersionId }
      : {}),
  });
  return firstRpcRow(data, error, "midi_pattern_create_failed");
}

export async function createMidiPatternVersionV3(input: {
  patternId: string;
  requestId: string;
  expectedVersionNumber: number;
  durationTicks: number;
  notes: Json[];
  publishForReuse: boolean;
  rightsAttestationVersion?: "cc-by-4.0-attestation-v1";
}) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("create_midi_pattern_version_v3", {
    p_pattern_id: input.patternId,
    p_request_id: input.requestId,
    p_expected_version_number: input.expectedVersionNumber,
    p_ppq: 480,
    p_duration_ticks: input.durationTicks,
    p_notes: input.notes,
    p_publish_for_reuse: input.publishForReuse,
    ...(input.rightsAttestationVersion
      ? { p_rights_attestation_version: input.rightsAttestationVersion }
      : {}),
  });
  return firstRpcRow(data, error, "midi_pattern_version_create_failed");
}

export async function createMidiProjectWorkspaceV3(input: {
  requestId: string;
  title: string;
  description: string;
  tempoBpm: number;
  musicalKey: string | null;
  timeSignatureNumerator: number;
  timeSignatureDenominator: number;
  licenseCode: string;
  genreIds: string[];
  primaryGenreId: string | null;
  tagIds: string[];
}) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("create_midi_project_workspace_v3", {
    p_request_id: input.requestId,
    p_title: input.title,
    p_description: input.description,
    p_bpm: input.tempoBpm,
    p_musical_key: input.musicalKey,
    p_time_signature_numerator: input.timeSignatureNumerator,
    p_time_signature_denominator: input.timeSignatureDenominator,
    p_license_code: input.licenseCode,
    p_genre_ids: input.genreIds,
    p_primary_genre_id: input.primaryGenreId,
    p_tag_ids: input.tagIds,
  } as unknown as Database["public"]["Functions"]["create_midi_project_workspace_v3"]["Args"]);
  return firstRpcRow(data, error, "midi_project_create_failed");
}

export async function saveMidiWorkspaceV3(input: {
  workspaceId: string;
  requestId: string;
  expectedLockVersion: number;
  manifest: Json;
}) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("save_midi_workspace_v3", {
    p_workspace_id: input.workspaceId,
    p_request_id: input.requestId,
    p_expected_lock_version: input.expectedLockVersion,
    p_manifest: input.manifest,
  });
  return firstRpcRow(data, error, "midi_workspace_save_failed");
}

export async function publishMidiWorkspaceRevisionV3(input: {
  workspaceId: string;
  requestId: string;
  expectedWorkspaceLockVersion: number;
  expectedBaseRevisionId: string | null;
  message: string | null;
}) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("publish_midi_workspace_revision_v3", {
    p_workspace_id: input.workspaceId,
    p_request_id: input.requestId,
    p_expected_workspace_lock_version: input.expectedWorkspaceLockVersion,
    p_expected_base_revision_id: input.expectedBaseRevisionId,
    p_message: input.message,
  } as unknown as Database["public"]["Functions"]["publish_midi_workspace_revision_v3"]["Args"]);
  if (error) {
    throw new Error(
      error.code === "PT409"
        ? "midi_workspace_publish_conflict"
        : "midi_workspace_publish_failed",
    );
  }
  if (!data?.[0]) throw new Error("midi_workspace_publish_failed");
  return data[0];
}

export async function createContributionWorkspaceV3(input: {
  projectId: string;
  requestId: string;
  expectedCurrentRevisionId: string;
  title: string;
  description: string;
}) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("create_contribution_workspace_v3", {
    p_project_id: input.projectId,
    p_request_id: input.requestId,
    p_expected_current_revision_id: input.expectedCurrentRevisionId,
    p_title: input.title,
    p_description: input.description,
  });
  return firstRpcRow(data, error, "midi_contribution_create_failed");
}

export async function submitContributionV3(input: {
  contributionId: string;
  requestId: string;
  expectedWorkspaceLockVersion: number;
  expectedBaseRevisionId: string;
  expectedManifestSha256: string;
  attestationVersion: "contributor-attestation-v1";
}) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("submit_contribution_v3", {
    p_contribution_id: input.contributionId,
    p_request_id: input.requestId,
    p_expected_workspace_lock_version: input.expectedWorkspaceLockVersion,
    p_expected_base_revision_id: input.expectedBaseRevisionId,
    p_expected_manifest_sha256: input.expectedManifestSha256,
    p_attestation_version: input.attestationVersion,
  });
  return firstRpcRow(data, error, "midi_contribution_submit_failed");
}

export async function acceptContributionV3(input: {
  contributionId: string;
  requestId: string;
  expectedContributionVersionId: string;
  expectedProjectRevisionId: string;
  message?: string;
}) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("accept_contribution_v3", {
    p_contribution_id: input.contributionId,
    p_request_id: input.requestId,
    p_expected_contribution_version_id: input.expectedContributionVersionId,
    p_expected_project_revision_id: input.expectedProjectRevisionId,
    ...(input.message ? { p_message: input.message } : {}),
  });
  return firstRpcRow(data, error, "midi_contribution_accept_failed");
}

export async function forkProjectV3(input: {
  sourceProjectId: string;
  sourceRevisionId: string;
  requestId: string;
  expectedLicenseCode: "cc-by-4.0";
  rightsAttestationVersion: "cc-by-4.0-reuse-attestation-v1";
  title: string;
  description: string;
}) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("fork_project_v3", {
    p_source_project_id: input.sourceProjectId,
    p_source_revision_id: input.sourceRevisionId,
    p_request_id: input.requestId,
    p_expected_license_code: input.expectedLicenseCode,
    p_rights_attestation_version: input.rightsAttestationVersion,
    p_title: input.title,
    p_description: input.description,
  });
  return firstRpcRow(data, error, "midi_project_fork_failed");
}
