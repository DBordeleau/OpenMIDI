import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getMidiStemVersionsByIds,
  listMidiStemVersionsForStudio,
} from "./midi-stems";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

const ownerId = "10000000-0000-4000-8000-000000000001";
const stemId = "10000000-0000-4000-8000-000000000002";

function versionId(index: number) {
  return `10000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
}

function versionRow(id: string) {
  return {
    content_sha256: "0".repeat(64),
    created_at: "2026-07-15T00:00:00.000Z",
    creator_credit_name: "Studio musician",
    default_preset_id: "warm-poly",
    default_preset_version: 1,
    duration_ticks: 480,
    id,
    name: "Part",
    note_count: 0,
    notes: [],
    owner_id: ownerId,
    parent_stem_version_id: null,
    ppq: 480,
    publication_request_id: null,
    source_draft_id: null,
    source_lock_version: null,
    stem_id: stemId,
    version: 1,
  };
}

describe("MIDI stem version repository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads the Studio library in one bounded query", async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [versionRow(versionId(1))],
      error: null,
    });
    const builder = {
      order: vi.fn(),
      limit,
    };
    builder.order.mockReturnValue(builder);
    const select = vi.fn().mockReturnValue(builder);
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({ select }),
    } as never);

    await expect(listMidiStemVersionsForStudio()).resolves.toHaveLength(1);
    expect(select).toHaveBeenCalledWith("*");
    expect(limit).toHaveBeenCalledWith(500);
  });

  it("batches exact references while preserving unique input order", async () => {
    const ids = Array.from({ length: 205 }, (_, index) => versionId(index + 1));
    const batches: string[][] = [];
    const select = vi.fn().mockImplementation(() => ({
      in: vi
        .fn()
        .mockImplementation(async (_column: string, batch: string[]) => {
          batches.push(batch);
          return {
            data: [...batch].reverse().map(versionRow),
            error: null,
          };
        }),
    }));
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({ select }),
    } as never);

    const versions = await getMidiStemVersionsByIds([
      ids[0]!,
      ...ids,
      ids[204]!,
    ]);

    expect(batches.map((batch) => batch.length)).toEqual([100, 100, 5]);
    expect(versions.map((version) => version.stemVersionId)).toEqual(ids);
  });
});
