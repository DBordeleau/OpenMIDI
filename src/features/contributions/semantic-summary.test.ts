import { describe, expect, it } from "vitest";
import type { MidiSemanticDiffV1 } from "@/features/midi/semantic-diff-v1";
import { summarizeContributionDiff } from "./semantic-summary";

describe("summarizeContributionDiff", () => {
  it("reports only changed semantic categories", () => {
    const diff = {
      algorithmVersion: "jam-session-midi-semantic-diff-1",
      unchanged: false,
      metadata: [{ field: "tempoBpm", before: 100, after: 120 }],
      tracks: [],
      clips: [
        {
          clipId: "clip",
          kind: "added",
          beforeTrackId: null,
          afterTrackId: "track",
          changes: [],
        },
      ],
      notes: [],
      lineage: [],
    } satisfies MidiSemanticDiffV1;
    expect(summarizeContributionDiff(diff)).toEqual([
      { label: "Arrangement metadata", count: 1 },
      { label: "Clips", count: 1 },
    ]);
  });
});
