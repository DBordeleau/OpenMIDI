import { describe, expect, it, vi } from "vitest";
import { freezeStudioPatternAction } from "./actions";
import {
  createMidiPatternV3,
  createMidiPatternVersionV3,
  getMidiPatternVersionV3,
} from "@/server/repositories/midi-v3";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/repositories/midi-stems", () => ({
  createImportedMidiStemDraft: vi.fn(),
  createMidiStemDraft: vi.fn(),
  getMidiStemDraft: vi.fn(),
  getMidiStemVersion: vi.fn(),
}));
vi.mock("@/server/repositories/workspaces", () => ({
  finalizeStudioMidiDraft: vi.fn(),
}));
vi.mock("@/server/repositories/midi-v3", () => ({
  createMidiPatternV3: vi.fn(),
  createMidiPatternVersionV3: vi.fn(),
  getMidiPatternVersionV3: vi.fn(),
}));

const id = (suffix: string) => `00000000-0000-4000-8000-${suffix}`;

describe("Studio pattern freezing", () => {
  it("creates the next immutable version on an owned pattern", async () => {
    vi.mocked(createMidiPatternVersionV3).mockResolvedValue({
      pattern_version_id: id("000000000008"),
    } as never);
    vi.mocked(getMidiPatternVersionV3).mockResolvedValue({
      id: id("000000000008"),
      midi_pattern_id: id("000000000001"),
      version_number: 2,
      creator_id: id("000000000002"),
      creator_credit_name: "Producer",
      parent_pattern_version_id: id("000000000003"),
      source_pattern_version_id: null,
      content_sha256: "a".repeat(64),
      note_count: 1,
      ppq: 480,
      duration_ticks: 1920,
      reuse_license_code: null,
      reuse_license_version: null,
      reuse_license_url: null,
      created_at: "2026-07-16T12:00:00.000Z",
      notes: [
        {
          midi_pattern_version_id: id("000000000008"),
          note_id: id("000000000009"),
          start_tick: 0,
          duration_ticks: 480,
          pitch: 60,
          velocity: 100,
        },
      ],
    } as never);

    const result = await freezeStudioPatternAction({
      patternRequestId: id("000000000004"),
      versionRequestId: id("000000000005"),
      name: "Variation",
      existingPatternId: id("000000000001"),
      expectedVersionNumber: 2,
      sourcePatternVersionId: null,
      content: {
        ppq: 480,
        durationTicks: 1920,
        notes: [
          {
            noteId: id("000000000009"),
            startTick: 0,
            durationTicks: 480,
            pitch: 60,
            velocity: 100,
          },
        ],
      },
    });

    expect(result.ok).toBe(true);
    expect(createMidiPatternV3).not.toHaveBeenCalled();
    expect(createMidiPatternVersionV3).toHaveBeenCalledWith(
      expect.objectContaining({
        patternId: id("000000000001"),
        expectedVersionNumber: 2,
      }),
    );
  });
});
