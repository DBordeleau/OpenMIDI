import "server-only";

import {
  MIDI_V3_MAX_RESOLVED_NOTES,
  MIDI_V3_REUSE_LICENSE,
} from "@/features/midi/domain-v3";
import {
  diffMidiArrangementsV1,
  type MidiSemanticDiffV1,
} from "@/features/midi/semantic-diff-v1";
import {
  publicMidiRevisionSchema,
  type PublicMidiRevision,
} from "@/features/public-midi/contract";
import { publicMidiDurationMs } from "@/features/public-midi/schedule";
import {
  parseArrangementManifestV3,
  parseMidiPatternVersionV3,
  type ArrangementManifestV3,
} from "@/features/studio/manifest/v3";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_PUBLIC_HISTORY_REVISIONS = 8;
const MAX_PUBLIC_HISTORY_NOTES =
  (MAX_PUBLIC_HISTORY_REVISIONS + 1) * MIDI_V3_MAX_RESOLVED_NOTES;

type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type PatternRow = Database["public"]["Tables"]["midi_pattern_versions"]["Row"];
type NoteRow = Database["public"]["Tables"]["midi_pattern_notes"]["Row"];

export type PublicArrangementCard = {
  manifest: ArrangementManifestV3;
  durationMs: number;
  tracks: Array<{
    id: string;
    name: string;
    sortOrder: number;
    preset: { id: string; version: number };
    clipCount: number;
  }>;
};

export type PublicRevisionHistoryItem = {
  id: string;
  revisionNumber: number;
  parentRevisionId: string | null;
  message: string | null;
  createdAt: string;
  durationMs: number;
  publisher: { creditName: string };
  acceptedContributor: { creditName: string } | null;
  summary: string[];
  algorithmVersion: string | null;
  patternLineage: Array<{
    midiPatternVersionId: string;
    creatorCreditName: string;
    parentMidiPatternVersionId: string | null;
    sourceMidiPatternVersionId: string | null;
  }>;
};

function mapPatternVersion(row: PatternRow, notes: NoteRow[]) {
  return parseMidiPatternVersionV3({
    midiPatternVersionId: row.id,
    midiPatternId: row.midi_pattern_id,
    version: row.version_number,
    creatorId: row.creator_id,
    creatorCreditName: row.creator_credit_name,
    parentMidiPatternVersionId: row.parent_pattern_version_id,
    sourceMidiPatternVersionId: row.source_pattern_version_id,
    contentSha256: row.content_sha256,
    noteCount: row.note_count,
    ppq: row.ppq,
    durationTicks: row.duration_ticks,
    reuseLicense:
      row.reuse_license_code === MIDI_V3_REUSE_LICENSE.code &&
      row.reuse_license_version === MIDI_V3_REUSE_LICENSE.version &&
      row.reuse_license_url === MIDI_V3_REUSE_LICENSE.url
        ? MIDI_V3_REUSE_LICENSE
        : null,
    createdAt: row.created_at,
    notes: notes.map((note) => ({
      noteId: note.note_id,
      startTick: note.start_tick,
      durationTicks: note.duration_ticks,
      pitch: note.pitch,
      velocity: note.velocity,
    })),
  });
}

async function loadPatternVersions(db: Db, ids: string[], maxNotes: number) {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return [];
  if (uniqueIds.length > 512) throw new Error("public_midi_pattern_limit");
  const [versions, notes] = await Promise.all([
    db.from("midi_pattern_versions").select("*").in("id", uniqueIds).limit(512),
    db
      .from("midi_pattern_notes")
      .select("*")
      .in("midi_pattern_version_id", uniqueIds)
      .order("start_tick")
      .order("pitch")
      .order("note_id")
      .limit(maxNotes + 1),
  ]);
  if (versions.error || notes.error)
    throw new Error("public_midi_patterns_unavailable");
  const expectedNotes = versions.data.reduce(
    (total, version) => total + version.note_count,
    0,
  );
  if (
    versions.data.length !== uniqueIds.length ||
    notes.data.length > maxNotes ||
    notes.data.length !== expectedNotes
  ) {
    throw new Error("public_midi_pattern_bounds_exceeded");
  }
  const notesByVersion = new Map<string, NoteRow[]>();
  for (const note of notes.data) {
    const grouped = notesByVersion.get(note.midi_pattern_version_id) ?? [];
    grouped.push(note);
    notesByVersion.set(note.midi_pattern_version_id, grouped);
  }
  return versions.data.map((version) =>
    mapPatternVersion(version, notesByVersion.get(version.id) ?? []),
  );
}

export async function getPublicArrangementCards(
  revisions: Array<{ projectId: string; revisionId: string }>,
) {
  const result = new Map<string, PublicArrangementCard>();
  if (revisions.length === 0) return result;
  if (revisions.length > 24) throw new Error("public_arrangement_card_limit");
  const db = await createSupabaseServerClient();
  const revisionIds = revisions.map(({ revisionId }) => revisionId);
  const { data: revisionRows, error: revisionError } = await db
    .from("project_revisions")
    .select("id,project_id,arrangement_version_id")
    .in("id", revisionIds)
    .eq("manifest_version", 3)
    .limit(24);
  if (revisionError) throw new Error("public_arrangements_unavailable");
  const arrangementIds = revisionRows.flatMap((row) =>
    row.arrangement_version_id ? [row.arrangement_version_id] : [],
  );
  if (arrangementIds.length !== revisions.length) return result;
  const { data: arrangements, error: arrangementError } = await db
    .from("arrangement_versions")
    .select("id,project_id,manifest")
    .in("id", arrangementIds)
    .limit(24);
  if (arrangementError) throw new Error("public_arrangements_unavailable");
  const arrangementById = new Map(arrangements.map((row) => [row.id, row]));
  for (const revision of revisionRows) {
    const arrangement = revision.arrangement_version_id
      ? arrangementById.get(revision.arrangement_version_id)
      : null;
    if (!arrangement || arrangement.project_id !== revision.project_id)
      continue;
    const manifest = parseArrangementManifestV3(arrangement.manifest);
    result.set(revision.id, {
      manifest,
      durationMs: publicMidiDurationMs(manifest),
      tracks: manifest.tracks.map((track) => ({
        id: track.trackId,
        name: track.name,
        sortOrder: track.sortOrder,
        preset: { id: track.presetId, version: track.presetVersion },
        clipCount: track.clips.length,
      })),
    });
  }
  return result;
}

export async function getPublicMidiRevision(input: {
  projectId: string;
  revisionId: string;
}): Promise<PublicMidiRevision | null> {
  const db = await createSupabaseServerClient();
  const { data: revision, error } = await db
    .from("project_revisions")
    .select(
      "id,project_id,revision_number,arrangement_version_id,revision_attributions(kind,credit_name)",
    )
    .eq("project_id", input.projectId)
    .eq("id", input.revisionId)
    .eq("manifest_version", 3)
    .maybeSingle();
  if (error) throw new Error("public_midi_revision_unavailable");
  if (!revision?.arrangement_version_id) return null;
  const [arrangementResult, projectResult] = await Promise.all([
    db
      .from("arrangement_versions")
      .select("manifest")
      .eq("project_id", input.projectId)
      .eq("id", revision.arrangement_version_id)
      .maybeSingle(),
    db
      .from("public_project_catalog")
      .select("title,license_code,license_name,license_url")
      .eq("project_id", input.projectId)
      .maybeSingle(),
  ]);
  if (arrangementResult.error || projectResult.error)
    throw new Error("public_midi_revision_unavailable");
  if (!arrangementResult.data || !projectResult.data) return null;
  const arrangement = arrangementResult.data;
  const project = projectResult.data;
  const manifest = parseArrangementManifestV3(arrangement.manifest);
  const patternIds = manifest.tracks.flatMap((track) =>
    track.clips.map((clip) => clip.midiPatternVersionId),
  );
  const patternVersions = await loadPatternVersions(
    db,
    patternIds,
    MIDI_V3_MAX_RESOLVED_NOTES,
  );
  return publicMidiRevisionSchema.parse({
    projectId: revision.project_id,
    revisionId: revision.id,
    revisionNumber: revision.revision_number,
    projectTitle: project.title,
    license: {
      code: project.license_code,
      name: project.license_name,
      url: project.license_url,
    },
    manifest,
    patternVersions,
    attributions: revision.revision_attributions.map((attribution) => ({
      kind: attribution.kind,
      creditName: attribution.credit_name,
    })),
  });
}

function summarizeDiff(diff: MidiSemanticDiffV1) {
  const summaries: string[] = [];
  if (diff.metadata.length > 0) {
    summaries.push(
      `Changed ${diff.metadata.map(({ field }) => (field === "tempoBpm" ? "tempo" : field === "timeSignature" ? "meter" : field === "musicalKey" ? "key" : "duration")).join(", ")}.`,
    );
  }
  const counts = (items: Array<{ kind: "added" | "removed" | "changed" }>) =>
    (["added", "removed", "changed"] as const)
      .map(
        (kind) =>
          [kind, items.filter((item) => item.kind === kind).length] as const,
      )
      .filter(([, count]) => count > 0)
      .map(([kind, count]) => `${count} ${kind}`)
      .join(", ");
  if (diff.tracks.length) summaries.push(`Tracks: ${counts(diff.tracks)}.`);
  if (diff.clips.length) summaries.push(`Clips: ${counts(diff.clips)}.`);
  if (diff.notes.length) summaries.push(`Notes: ${counts(diff.notes)}.`);
  if (diff.lineage.length) {
    summaries.push(
      `${diff.lineage.length} pattern lineage ${diff.lineage.length === 1 ? "change" : "changes"}.`,
    );
  }
  return summaries.length ? summaries : ["No semantic musical changes."];
}

export async function getPublicRevisionHistory(
  projectId: string,
): Promise<PublicRevisionHistoryItem[]> {
  const db = await createSupabaseServerClient();
  const { data: revisions, error } = await db
    .from("project_revisions")
    .select(
      "id,revision_number,parent_revision_id,message,created_at,arrangement_version_id,revision_attributions(kind,credit_name)",
    )
    .eq("project_id", projectId)
    .eq("manifest_version", 3)
    .order("revision_number", { ascending: false })
    .limit(MAX_PUBLIC_HISTORY_REVISIONS + 1);
  if (error) throw new Error("public_revision_history_unavailable");
  const visibleRevisions = revisions.slice(0, MAX_PUBLIC_HISTORY_REVISIONS);
  const arrangementIds = revisions.flatMap((revision) =>
    revision.arrangement_version_id ? [revision.arrangement_version_id] : [],
  );
  if (arrangementIds.length !== revisions.length) return [];
  const { data: arrangements, error: arrangementError } = await db
    .from("arrangement_versions")
    .select("id,manifest")
    .in("id", arrangementIds)
    .limit(MAX_PUBLIC_HISTORY_REVISIONS + 1);
  if (arrangementError) throw new Error("public_revision_history_unavailable");
  const manifestByArrangement = new Map(
    arrangements.map((row) => [
      row.id,
      parseArrangementManifestV3(row.manifest),
    ]),
  );
  const patternIds = [...manifestByArrangement.values()].flatMap((manifest) =>
    manifest.tracks.flatMap((track) =>
      track.clips.map((clip) => clip.midiPatternVersionId),
    ),
  );
  const patternVersions = await loadPatternVersions(
    db,
    patternIds,
    MAX_PUBLIC_HISTORY_NOTES,
  );
  const patternsById = new Map(
    patternVersions.map((pattern) => [pattern.midiPatternVersionId, pattern]),
  );
  const revisionById = new Map(
    revisions.map((revision) => [revision.id, revision]),
  );
  return visibleRevisions.map((revision) => {
    const manifest = manifestByArrangement.get(
      revision.arrangement_version_id!,
    );
    if (!manifest) throw new Error("public_revision_history_invalid");
    const patterns = [
      ...new Set(
        manifest.tracks.flatMap((track) =>
          track.clips.map((clip) => clip.midiPatternVersionId),
        ),
      ),
    ].map((id) => {
      const pattern = patternsById.get(id);
      if (!pattern) throw new Error("public_revision_history_invalid");
      return pattern;
    });
    const parent = revision.parent_revision_id
      ? revisionById.get(revision.parent_revision_id)
      : null;
    let summary: string[];
    let algorithmVersion: string | null = null;
    if (parent?.arrangement_version_id) {
      const parentManifest = manifestByArrangement.get(
        parent.arrangement_version_id,
      );
      if (!parentManifest) throw new Error("public_revision_history_invalid");
      const parentPatterns = [
        ...new Set(
          parentManifest.tracks.flatMap((track) =>
            track.clips.map((clip) => clip.midiPatternVersionId),
          ),
        ),
      ].map((id) => patternsById.get(id)!);
      const diff = diffMidiArrangementsV1(
        { manifest: parentManifest, patternVersions: parentPatterns },
        { manifest, patternVersions: patterns },
      );
      summary = summarizeDiff(diff);
      algorithmVersion = diff.algorithmVersion;
    } else {
      const clipCount = manifest.tracks.reduce(
        (total, track) => total + track.clips.length,
        0,
      );
      summary = [
        `Started with ${manifest.tracks.length} ${manifest.tracks.length === 1 ? "track" : "tracks"}, ${clipCount} ${clipCount === 1 ? "clip" : "clips"}, and ${patterns.length} MIDI ${patterns.length === 1 ? "pattern" : "patterns"}.`,
      ];
    }
    const publisher = revision.revision_attributions.find(
      ({ kind }) => kind === "publisher",
    );
    if (!publisher) throw new Error("public_revision_attribution_missing");
    const acceptedContributor = revision.revision_attributions.find(
      ({ kind }) => kind === "accepted_contributor",
    );
    return {
      id: revision.id,
      revisionNumber: revision.revision_number,
      parentRevisionId: revision.parent_revision_id,
      message: revision.message,
      createdAt: revision.created_at,
      durationMs: publicMidiDurationMs(manifest),
      publisher: { creditName: publisher.credit_name },
      acceptedContributor: acceptedContributor
        ? { creditName: acceptedContributor.credit_name }
        : null,
      summary,
      algorithmVersion,
      patternLineage: patterns.map((pattern) => ({
        midiPatternVersionId: pattern.midiPatternVersionId,
        creatorCreditName: pattern.creatorCreditName,
        parentMidiPatternVersionId: pattern.parentMidiPatternVersionId,
        sourceMidiPatternVersionId: pattern.sourceMidiPatternVersionId,
      })),
    };
  });
}
