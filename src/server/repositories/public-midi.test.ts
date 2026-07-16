import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  V3_MANIFEST_BEFORE,
  V3_PATTERN_VERSION_1,
} from "@/features/studio/manifest/v3.fixtures";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  limits: [] as Array<{ table: string; limit: number }>,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ from: mocks.from }),
}));

import { getPublicRevisionHistory } from "./public-midi";

const revisionId = (revision: number) =>
  `40000000-0000-4000-8000-${revision.toString().padStart(12, "0")}`;
const arrangementVersionId = "40000000-0000-4000-8000-000000000100";

describe("public MIDI revision history", () => {
  beforeEach(() => {
    mocks.limits.length = 0;
    const revisions = Array.from({ length: 9 }, (_, index) => {
      const revisionNumber = 9 - index;
      return {
        id: revisionId(revisionNumber),
        revision_number: revisionNumber,
        parent_revision_id:
          revisionNumber === 1 ? null : revisionId(revisionNumber - 1),
        message: `Revision ${revisionNumber}`,
        created_at: `2026-07-${revisionNumber.toString().padStart(2, "0")}T00:00:00.000Z`,
        arrangement_version_id: arrangementVersionId,
        revision_attributions: [
          { kind: "publisher", credit_name: "History Maker" },
        ],
      };
    });
    const pattern = V3_PATTERN_VERSION_1;
    const rows = {
      project_revisions: revisions,
      arrangement_versions: [
        {
          id: arrangementVersionId,
          manifest: V3_MANIFEST_BEFORE,
        },
      ],
      midi_pattern_versions: [
        {
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
        },
      ],
      midi_pattern_notes: pattern.notes.map((note) => ({
        midi_pattern_version_id: pattern.midiPatternVersionId,
        note_id: note.noteId,
        start_tick: note.startTick,
        duration_ticks: note.durationTicks,
        pitch: note.pitch,
        velocity: note.velocity,
      })),
    };
    mocks.from.mockImplementation((table: keyof typeof rows) => {
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        order: () => query,
        limit: (limit: number) => {
          mocks.limits.push({ table, limit });
          return Promise.resolve({ data: rows[table], error: null });
        },
      };
      return query;
    });
  });

  it("loads one parent beyond the eight visible revisions", async () => {
    const history = await getPublicRevisionHistory(
      V3_MANIFEST_BEFORE.projectId,
    );

    expect(history).toHaveLength(8);
    expect(history.at(-1)).toMatchObject({
      revisionNumber: 2,
      parentRevisionId: revisionId(1),
      algorithmVersion: "jam-session-midi-semantic-diff-1",
      summary: ["No semantic musical changes."],
    });
    expect(mocks.limits).toContainEqual({
      table: "project_revisions",
      limit: 9,
    });
  });
});
