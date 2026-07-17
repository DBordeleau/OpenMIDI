import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  V3_MANIFEST_AFTER,
  V3_MANIFEST_BEFORE,
  V3_PATTERN_VERSION_1,
  V3_PATTERN_VERSION_2,
} from "@/features/studio/manifest/v3.fixtures";

const projectId = V3_MANIFEST_BEFORE.projectId;
const revision1 = "41000000-0000-4000-8000-000000000001";
const revision2 = "41000000-0000-4000-8000-000000000002";
const revision3 = "41000000-0000-4000-8000-000000000003";
const arrangement1 = "42000000-0000-4000-8000-000000000001";
const arrangement2 = "42000000-0000-4000-8000-000000000002";
const arrangement3 = "42000000-0000-4000-8000-000000000003";

type Scenario = {
  memberProject: { id: string; title: string; moderation_state: string } | null;
  publicProject: { project_id: string; title: string } | null;
  revisions: Array<Record<string, unknown>>;
  arrangements: Array<Record<string, unknown>>;
  patterns: Array<Record<string, unknown>>;
  notes: Array<Record<string, unknown>>;
};

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
let scenario: Scenario;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ from: mocks.from }),
}));

import { getProjectRevisionComparison } from "./project-revision-comparisons";

function patternRow(pattern: typeof V3_PATTERN_VERSION_1) {
  return {
    id: pattern.midiPatternVersionId,
    midi_pattern_id: pattern.midiPatternId,
    version_number: pattern.version,
    creator_id: pattern.creatorId,
    creator_credit_name: pattern.creatorCreditName,
    parent_pattern_version_id: pattern.parentMidiPatternVersionId,
    source_pattern_version_id: pattern.sourceMidiPatternVersionId,
    content_sha256: pattern.contentSha256,
    note_count: pattern.noteCount,
    ppq: pattern.ppq,
    duration_ticks: pattern.durationTicks,
    reuse_license_code: null,
    reuse_license_version: null,
    reuse_license_url: null,
    created_at: pattern.createdAt,
  };
}

function noteRows(pattern: typeof V3_PATTERN_VERSION_1) {
  return pattern.notes.map((note) => ({
    midi_pattern_version_id: pattern.midiPatternVersionId,
    note_id: note.noteId,
    start_tick: note.startTick,
    duration_ticks: note.durationTicks,
    pitch: note.pitch,
    velocity: note.velocity,
  }));
}

function revisionRow(
  id: string,
  revisionNumber: number,
  parentRevisionId: string | null,
  arrangementVersionId: string,
) {
  return {
    id,
    revision_number: revisionNumber,
    parent_revision_id: parentRevisionId,
    message: `Revision ${revisionNumber}`,
    created_at: `2026-07-${revisionNumber.toString().padStart(2, "0")}T00:00:00.000Z`,
    arrangement_version_id: arrangementVersionId,
    revision_attributions: [{ kind: "publisher", credit_name: "Loop Maker" }],
  };
}

function baseScenario(): Scenario {
  return {
    memberProject: null,
    publicProject: { project_id: projectId, title: "Public loop" },
    revisions: [
      revisionRow(revision3, 3, revision2, arrangement3),
      revisionRow(revision2, 2, revision1, arrangement2),
      revisionRow(revision1, 1, null, arrangement1),
    ],
    arrangements: [
      { id: arrangement1, project_id: projectId, manifest: V3_MANIFEST_BEFORE },
      { id: arrangement2, project_id: projectId, manifest: V3_MANIFEST_BEFORE },
      { id: arrangement3, project_id: projectId, manifest: V3_MANIFEST_AFTER },
    ],
    patterns: [
      patternRow(V3_PATTERN_VERSION_1),
      patternRow(V3_PATTERN_VERSION_2),
    ],
    notes: [
      ...noteRows(V3_PATTERN_VERSION_1),
      ...noteRows(V3_PATTERN_VERSION_2),
    ],
  };
}

function rowsFor(table: string) {
  if (table === "project_revisions") return scenario.revisions;
  if (table === "arrangement_versions") return scenario.arrangements;
  if (table === "midi_pattern_versions") return scenario.patterns;
  if (table === "midi_pattern_notes") return scenario.notes;
  return [];
}

beforeEach(() => {
  scenario = baseScenario();
  mocks.from.mockReset();
  mocks.from.mockImplementation((table: string) => {
    const inFilters = new Map<string, unknown[]>();
    const query = {
      select: () => query,
      eq: () => query,
      is: () => query,
      not: () => query,
      order: () => query,
      in: (column: string, values: unknown[]) => {
        inFilters.set(column, values);
        return query;
      },
      maybeSingle: async () => ({
        data:
          table === "projects"
            ? scenario.memberProject
            : table === "public_project_catalog"
              ? scenario.publicProject
              : null,
        error: null,
      }),
      limit: async (limit: number) => {
        let rows = rowsFor(table);
        for (const [column, values] of inFilters) {
          rows = rows.filter((row) => values.includes(row[column]));
        }
        return { data: rows.slice(0, limit), error: null };
      },
    };
    return query;
  });
});

describe("authorized project revision comparisons", () => {
  it.each(["anonymous", "authenticated unrelated"])(
    "loads the same bounded public pair for a %s visitor",
    async () => {
      const result = await getProjectRevisionComparison({
        projectId,
        fromRevisionId: revision1,
        toRevisionId: revision3,
      });
      expect(result.status).toBe("ready");
      if (result.status !== "ready") return;
      expect(result.comparison.revisions).toHaveLength(3);
      expect(result.comparison.semanticDiff.unchanged).toBe(false);
      expect(result.comparison.before.revisionNumber).toBe(1);
      expect(result.comparison.after.revisionNumber).toBe(3);
      expect(result.comparison).not.toHaveProperty("memberships");
      expect(result.comparison).not.toHaveProperty("workspace");
    },
  );

  it("loads a private project only when the user-scoped client returns membership access", async () => {
    scenario.memberProject = {
      id: projectId,
      title: "Private loop",
      moderation_state: "visible",
    };
    scenario.publicProject = null;
    const result = await getProjectRevisionComparison({
      projectId,
      fromRevisionId: revision1,
      toRevisionId: revision3,
    });
    expect(result.status).toBe("ready");
  });

  it("fails closed for an unauthorized private project", async () => {
    scenario.publicProject = null;
    await expect(getProjectRevisionComparison({ projectId })).resolves.toEqual({
      status: "not_found",
    });
  });

  it("fails closed for a moderated project even when membership can see its row", async () => {
    scenario.memberProject = {
      id: projectId,
      title: "Hidden loop",
      moderation_state: "hidden",
    };
    scenario.publicProject = null;
    await expect(getProjectRevisionComparison({ projectId })).resolves.toEqual({
      status: "not_found",
    });
  });

  it("rejects a revision ID outside the authorized route project", async () => {
    const result = await getProjectRevisionComparison({
      projectId,
      fromRevisionId: "49000000-0000-4000-8000-000000000099",
      toRevisionId: revision3,
    });
    expect(result).toEqual({
      status: "unavailable",
      project: { id: projectId, title: "Public loop" },
    });
  });

  it("defaults the latest revision against its exact parent", async () => {
    const result = await getProjectRevisionComparison({ projectId });
    expect(result).toMatchObject({
      status: "ready",
      canonicalPair: { from: revision2, to: revision3 },
    });
  });

  it("handles same-revision and one-revision histories without invented changes", async () => {
    const same = await getProjectRevisionComparison({
      projectId,
      fromRevisionId: revision2,
      toRevisionId: revision2,
    });
    expect(same.status).toBe("ready");
    if (same.status === "ready") {
      expect(same.comparison.semanticDiff.unchanged).toBe(true);
      expect(same.comparison.onlyRevision).toBe(false);
    }

    scenario.revisions = [scenario.revisions[2]];
    scenario.arrangements = [scenario.arrangements[0]];
    scenario.patterns = [scenario.patterns[0]];
    scenario.notes = noteRows(V3_PATTERN_VERSION_1);
    const one = await getProjectRevisionComparison({ projectId });
    expect(one).toMatchObject({
      status: "ready",
      canonicalPair: { from: revision1, to: revision1 },
      comparison: { onlyRevision: true, semanticDiff: { unchanged: true } },
    });
  });

  it("returns an honest unavailable state when an immutable pattern is missing", async () => {
    scenario.patterns = [scenario.patterns[0]];
    const result = await getProjectRevisionComparison({
      projectId,
      fromRevisionId: revision1,
      toRevisionId: revision3,
    });
    expect(result.status).toBe("unavailable");
  });

  it("fails before loading payloads when revision history exceeds the selector bound", async () => {
    scenario.revisions = Array.from({ length: 21 }, (_, index) =>
      revisionRow(
        `43000000-0000-4000-8000-${(index + 1).toString().padStart(12, "0")}`,
        index + 1,
        null,
        arrangement1,
      ),
    );
    const result = await getProjectRevisionComparison({ projectId });
    expect(result.status).toBe("over_limit");
  });
});
