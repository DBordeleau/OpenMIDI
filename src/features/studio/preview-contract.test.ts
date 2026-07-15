import { describe, expect, it } from "vitest";
import { quickPreviewResponseSchema } from "./preview-contract";
import { MIDI_SINGLE_TRACK_FIXTURE } from "@/features/midi/fixtures";

describe("quickPreviewResponseSchema", () => {
  it("accepts a bounded signed preview", () => {
    const parsed = quickPreviewResponseSchema.parse({
      kind: "audio",
      projectId: "10000000-0000-4000-8000-000000000001",
      revisionId: "20000000-0000-4000-8000-000000000001",
      durationMs: 1_000,
      tracks: [
        {
          trackId: "30000000-0000-4000-8000-000000000001",
          signedUrl: "https://example.test/signed/source",
          positionMs: 0,
          trimStartMs: 0,
          durationMs: 1_000,
          gainDb: 0,
          pan: 0,
          muted: false,
          soloed: false,
        },
      ],
    });
    expect(parsed.kind === "audio" ? parsed.tracks : []).toHaveLength(1);
  });

  it("rejects an empty preview", () => {
    expect(() =>
      quickPreviewResponseSchema.parse({
        kind: "audio",
        projectId: "10000000-0000-4000-8000-000000000001",
        revisionId: "20000000-0000-4000-8000-000000000001",
        durationMs: 1_000,
        tracks: [],
      }),
    ).toThrow();
  });

  it("accepts a bounded MIDI preview without signed source URLs", () => {
    const parsed = quickPreviewResponseSchema.parse({
      kind: "midi",
      projectId: MIDI_SINGLE_TRACK_FIXTURE.manifest.projectId,
      revisionId: "20000000-0000-4000-8000-000000000001",
      durationMs: 4_000,
      manifest: MIDI_SINGLE_TRACK_FIXTURE.manifest,
      stems: [...MIDI_SINGLE_TRACK_FIXTURE.stemVersions.values()],
    });
    expect(parsed.kind).toBe("midi");
    expect("tracks" in parsed).toBe(false);
    if (parsed.kind === "midi") expect(parsed.audioSources).toEqual([]);
  });
});
