import "server-only";

import { z } from "zod";
import { MIDI_V3_MAX_RESOLVED_NOTES } from "@/features/midi/domain-v3";
import { diffMidiArrangementsV1 } from "@/features/midi/semantic-diff-v1";
import type {
  ProjectRevisionComparisonResult,
  ProjectRevisionComparisonSide,
  ProjectRevisionOption,
} from "@/features/midi-diff/project-revision-types";
import {
  parseArrangementManifestV3,
  parseMidiPatternVersionV3,
} from "@/features/studio/manifest/v3";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_COMPARABLE_REVISIONS = 20;
const MAX_PATTERN_VERSIONS = 512;
const MAX_PAIR_NOTES = MIDI_V3_MAX_RESOLVED_NOTES * 2;
const revisionIdSchema = z.string().uuid();

type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type PatternRow = Database["public"]["Tables"]["midi_pattern_versions"]["Row"];
type NoteRow = Database["public"]["Tables"]["midi_pattern_notes"]["Row"];

type RevisionRow = {
  id: string;
  revision_number: number;
  parent_revision_id: string | null;
  message: string | null;
  created_at: string;
  arrangement_version_id: string | null;
  revision_attributions: Array<{
    kind: string;
    credit_name: string;
  }>;
};

function mapRevisionOption(row: RevisionRow): ProjectRevisionOption {
  return {
    id: row.id,
    revisionNumber: row.revision_number,
    parentRevisionId: row.parent_revision_id,
    message: row.message,
    createdAt: row.created_at,
  };
}

export function resolveProjectRevisionPair(
  revisions: ProjectRevisionOption[],
  requested: { from?: string; to?: string },
): { from: string; to: string } | null {
  if (revisions.length === 0) return null;
  const byId = new Map(revisions.map((revision) => [revision.id, revision]));
  if (
    (requested.from && !byId.has(requested.from)) ||
    (requested.to && !byId.has(requested.to))
  ) {
    return null;
  }

  const selected = requested.to
    ? byId.get(requested.to)!
    : requested.from
      ? byId.get(requested.from)!
      : revisions[0];
  const to = requested.to ?? selected.id;
  const from =
    requested.from ??
    (selected.parentRevisionId && byId.has(selected.parentRevisionId)
      ? selected.parentRevisionId
      : selected.id);
  return { from, to };
}

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
      row.reuse_license_code &&
      row.reuse_license_version &&
      row.reuse_license_url
        ? {
            code: row.reuse_license_code,
            version: row.reuse_license_version,
            url: row.reuse_license_url,
          }
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

async function loadComparisonSides(
  db: Db,
  projectId: string,
  rows: RevisionRow[],
): Promise<ProjectRevisionComparisonSide[] | "over_limit" | null> {
  const uniqueRows = [...new Map(rows.map((row) => [row.id, row])).values()];
  const arrangementIds = uniqueRows.flatMap((row) =>
    row.arrangement_version_id ? [row.arrangement_version_id] : [],
  );
  if (arrangementIds.length !== uniqueRows.length) return null;

  const { data: arrangements, error: arrangementError } = await db
    .from("arrangement_versions")
    .select("id,project_id,manifest")
    .eq("project_id", projectId)
    .in("id", arrangementIds)
    .limit(2);
  if (arrangementError) throw new Error("revision_comparison_unavailable");
  if (arrangements.length !== arrangementIds.length) return null;

  const manifestByArrangement = new Map(
    arrangements.map((row) => [
      row.id,
      parseArrangementManifestV3(row.manifest),
    ]),
  );
  const patternIds = [
    ...new Set(
      [...manifestByArrangement.values()].flatMap((manifest) =>
        manifest.tracks.flatMap((track) =>
          track.clips.map((clip) => clip.midiPatternVersionId),
        ),
      ),
    ),
  ];
  if (patternIds.length > MAX_PATTERN_VERSIONS) return "over_limit";

  const [versions, notes] = await Promise.all([
    patternIds.length === 0
      ? Promise.resolve({ data: [] as PatternRow[], error: null })
      : db
          .from("midi_pattern_versions")
          .select("*")
          .in("id", patternIds)
          .limit(MAX_PATTERN_VERSIONS),
    patternIds.length === 0
      ? Promise.resolve({ data: [] as NoteRow[], error: null })
      : db
          .from("midi_pattern_notes")
          .select("*")
          .in("midi_pattern_version_id", patternIds)
          .order("start_tick")
          .order("pitch")
          .order("note_id")
          .limit(MAX_PAIR_NOTES + 1),
  ]);
  if (versions.error || notes.error)
    throw new Error("revision_comparison_patterns_unavailable");
  const expectedNotes = versions.data.reduce(
    (total, version) => total + version.note_count,
    0,
  );
  if (
    versions.data.length !== patternIds.length ||
    notes.data.length > MAX_PAIR_NOTES ||
    notes.data.length !== expectedNotes
  ) {
    return notes.data.length > MAX_PAIR_NOTES ? "over_limit" : null;
  }

  const notesByVersion = new Map<string, NoteRow[]>();
  for (const note of notes.data) {
    const grouped = notesByVersion.get(note.midi_pattern_version_id) ?? [];
    grouped.push(note);
    notesByVersion.set(note.midi_pattern_version_id, grouped);
  }
  const patternsById = new Map(
    versions.data.map((version) => {
      const pattern = mapPatternVersion(
        version,
        notesByVersion.get(version.id) ?? [],
      );
      return [pattern.midiPatternVersionId, pattern] as const;
    }),
  );

  return rows.map((row) => {
    const manifest = manifestByArrangement.get(row.arrangement_version_id!);
    if (!manifest) throw new Error("revision_comparison_manifest_missing");
    const patternVersions = [
      ...new Set(
        manifest.tracks.flatMap((track) =>
          track.clips.map((clip) => clip.midiPatternVersionId),
        ),
      ),
    ].map((id) => {
      const pattern = patternsById.get(id);
      if (!pattern) throw new Error("revision_comparison_pattern_missing");
      return pattern;
    });
    return {
      revisionId: row.id,
      revisionNumber: row.revision_number,
      arrangementVersionId: row.arrangement_version_id!,
      manifest,
      patternVersions,
      attributions: row.revision_attributions.flatMap((attribution) =>
        attribution.kind === "publisher" ||
        attribution.kind === "accepted_contributor"
          ? [
              {
                kind: attribution.kind,
                creditName: attribution.credit_name,
              },
            ]
          : [],
      ),
    } satisfies ProjectRevisionComparisonSide;
  });
}

async function loadAuthorizedProject(db: Db, projectId: string) {
  const { data: publicProject, error: publicError } = await db
    .from("public_project_catalog")
    .select("project_id,title")
    .eq("project_id", projectId)
    .maybeSingle();
  if (publicError) throw new Error("revision_comparison_project_unavailable");
  if (publicProject) {
    return { id: publicProject.project_id, title: publicProject.title };
  }

  const { data: memberProject, error: memberError } = await db
    .from("projects")
    .select("id,title,moderation_state")
    .eq("id", projectId)
    .is("deleted_at", null)
    .maybeSingle();
  if (memberError) return null;
  if (memberProject) {
    if (memberProject.moderation_state !== "visible") return null;
    return { id: memberProject.id, title: memberProject.title };
  }
  return null;
}

export async function getProjectRevisionComparison(input: {
  projectId: string;
  fromRevisionId?: string;
  toRevisionId?: string;
}): Promise<ProjectRevisionComparisonResult> {
  if (
    !revisionIdSchema.safeParse(input.projectId).success ||
    (input.fromRevisionId &&
      !revisionIdSchema.safeParse(input.fromRevisionId).success) ||
    (input.toRevisionId &&
      !revisionIdSchema.safeParse(input.toRevisionId).success)
  ) {
    return { status: "not_found" };
  }

  const db = await createSupabaseServerClient();
  const project = await loadAuthorizedProject(db, input.projectId);
  if (!project) return { status: "not_found" };

  const { data: revisionRows, error: revisionError } = await db
    .from("project_revisions")
    .select(
      "id,revision_number,parent_revision_id,message,created_at,arrangement_version_id,revision_attributions(kind,credit_name)",
    )
    .eq("project_id", input.projectId)
    .eq("manifest_version", 3)
    .not("arrangement_version_id", "is", null)
    .order("revision_number", { ascending: false })
    .limit(MAX_COMPARABLE_REVISIONS + 1);
  if (revisionError)
    throw new Error("revision_comparison_revisions_unavailable");
  if (revisionRows.length > MAX_COMPARABLE_REVISIONS)
    return { status: "over_limit", project };
  if (revisionRows.length === 0) return { status: "unavailable", project };

  const rows = revisionRows as RevisionRow[];
  const revisions = rows.map(mapRevisionOption);
  const canonicalPair = resolveProjectRevisionPair(revisions, {
    from: input.fromRevisionId,
    to: input.toRevisionId,
  });
  if (!canonicalPair) return { status: "unavailable", project };
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const beforeRow = rowById.get(canonicalPair.from);
  const afterRow = rowById.get(canonicalPair.to);
  if (!beforeRow || !afterRow) return { status: "unavailable", project };

  try {
    const sides = await loadComparisonSides(db, input.projectId, [
      beforeRow,
      afterRow,
    ]);
    if (sides === "over_limit") return { status: "over_limit", project };
    if (!sides) return { status: "unavailable", project };
    const [before, after] = sides;
    const semanticDiff = diffMidiArrangementsV1(
      { manifest: before.manifest, patternVersions: before.patternVersions },
      { manifest: after.manifest, patternVersions: after.patternVersions },
    );
    return {
      status: "ready",
      canonicalPair,
      comparison: {
        project,
        revisions,
        before,
        after,
        semanticDiff,
        onlyRevision: revisions.length === 1,
      },
    };
  } catch (error) {
    if (
      error instanceof z.ZodError ||
      (error instanceof Error &&
        error.message.startsWith("revision_comparison_"))
    ) {
      return { status: "unavailable", project };
    }
    throw error;
  }
}
