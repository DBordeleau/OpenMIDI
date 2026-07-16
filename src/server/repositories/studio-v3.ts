import "server-only";

import { MIDI_V3_REUSE_LICENSE } from "@/features/midi/domain-v3";
import {
  parseArrangementManifestV3,
  parseMidiPatternVersionV3,
  parseWorkspaceManifestV3,
  sha256ManifestV3,
  type ArrangementManifestV3,
  type WorkspaceManifestV3,
} from "@/features/studio/manifest/v3";
import type { StudioPatternVersion } from "@/features/studio/midi-adapter/manifest-v3-editor";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMidiPatternVersionV3 } from "./midi-v3";

export type StudioWorkspaceV3 = {
  id: string;
  projectId: string;
  ownerId: string;
  contributionId: string | null;
  baseRevisionId: string | null;
  lockVersion: number;
  manifest: WorkspaceManifestV3;
  manifestSha256: string;
  updatedAt: string;
};

export type StudioRevisionV3 = {
  projectId: string;
  revisionId: string;
  revisionNumber: number;
  arrangementVersionId: string;
  manifest: ArrangementManifestV3;
  manifestSha256: string;
  durationMs: number;
};

export async function getStudioWorkspaceV3(
  projectId: string,
): Promise<StudioWorkspaceV3 | null> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("workspaces")
    .select(
      "id,project_id,owner_id,contribution_id,base_revision_id,lock_version,manifest,manifest_version,engine,engine_version,manifest_sha256,snapshot_asset_id,updated_at",
    )
    .eq("project_id", projectId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error("studio_workspace_unavailable");
  if (!data) return null;
  if (
    data.manifest_version !== 3 ||
    data.engine !== "jam-session-midi" ||
    data.engine_version !== "jam-session-midi-3_tone-15.1.22_presets-1" ||
    data.snapshot_asset_id !== null
  ) {
    throw new Error("studio_workspace_requires_manifest_v3");
  }
  const manifest = parseWorkspaceManifestV3(data.manifest);
  if (
    manifest.projectId !== projectId ||
    manifest.workspaceId !== data.id ||
    (await sha256ManifestV3(manifest)) !== data.manifest_sha256
  ) {
    throw new Error("studio_workspace_invalid");
  }
  return {
    id: data.id,
    projectId: data.project_id,
    ownerId: data.owner_id,
    contributionId: data.contribution_id,
    baseRevisionId: data.base_revision_id,
    lockVersion: data.lock_version,
    manifest,
    manifestSha256: data.manifest_sha256,
    updatedAt: data.updated_at,
  };
}

export async function getStudioRevisionV3(input: {
  projectId: string;
  revisionId: string;
}): Promise<StudioRevisionV3 | null> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("project_revisions")
    .select(
      "id,project_id,revision_number,arrangement_version_id,manifest,manifest_version,engine,engine_version,manifest_sha256,duration_ms,snapshot_asset_id",
    )
    .eq("project_id", input.projectId)
    .eq("id", input.revisionId)
    .maybeSingle();
  if (error) throw new Error("studio_revision_unavailable");
  if (!data) return null;
  if (
    data.manifest_version !== 3 ||
    data.engine !== "jam-session-midi" ||
    data.engine_version !== "jam-session-midi-3_tone-15.1.22_presets-1" ||
    !data.arrangement_version_id ||
    data.snapshot_asset_id !== null
  ) {
    throw new Error("studio_revision_requires_manifest_v3");
  }
  const manifest = parseArrangementManifestV3(data.manifest);
  if (
    manifest.projectId !== input.projectId ||
    (await sha256ManifestV3(manifest)) !== data.manifest_sha256
  ) {
    throw new Error("studio_revision_invalid");
  }
  return {
    projectId: data.project_id,
    revisionId: data.id,
    revisionNumber: data.revision_number,
    arrangementVersionId: data.arrangement_version_id,
    manifest,
    manifestSha256: data.manifest_sha256,
    durationMs: data.duration_ms,
  };
}

export async function loadStudioPatternVersions(
  manifest: WorkspaceManifestV3 | ArrangementManifestV3,
): Promise<StudioPatternVersion[]> {
  const contexts = new Map<
    string,
    { name: string; presetId: string; presetVersion: number }
  >();
  for (const track of manifest.tracks) {
    for (const clip of track.clips) {
      if (!contexts.has(clip.midiPatternVersionId)) {
        contexts.set(clip.midiPatternVersionId, {
          name: track.name,
          presetId: track.presetId,
          presetVersion: track.presetVersion,
        });
      }
    }
  }
  return Promise.all(
    [...contexts].map(async ([id, context]) => {
      const record = await getMidiPatternVersionV3(id);
      if (!record) throw new Error("studio_pattern_version_unavailable");
      const reuseLicense =
        record.reuse_license_code === MIDI_V3_REUSE_LICENSE.code &&
        record.reuse_license_version === MIDI_V3_REUSE_LICENSE.version &&
        record.reuse_license_url === MIDI_V3_REUSE_LICENSE.url
          ? MIDI_V3_REUSE_LICENSE
          : null;
      return {
        ...parseMidiPatternVersionV3({
          midiPatternVersionId: record.id,
          midiPatternId: record.midi_pattern_id,
          version: record.version_number,
          creatorId: record.creator_id,
          creatorCreditName: record.creator_credit_name,
          parentMidiPatternVersionId: record.parent_pattern_version_id,
          sourceMidiPatternVersionId: record.source_pattern_version_id,
          contentSha256: record.content_sha256,
          noteCount: record.note_count,
          ppq: record.ppq,
          durationTicks: record.duration_ticks,
          reuseLicense,
          createdAt: record.created_at,
          notes: record.notes.map((note) => ({
            noteId: note.note_id,
            startTick: note.start_tick,
            durationTicks: note.duration_ticks,
            pitch: note.pitch,
            velocity: note.velocity,
          })),
        }),
        ...context,
      };
    }),
  );
}
