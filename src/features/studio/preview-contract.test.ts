import { describe, expect, it } from "vitest";
import { quickPreviewResponseSchema } from "./preview-contract";

describe("quickPreviewResponseSchema", () => {
  it("accepts a bounded signed preview", () => {
    expect(
      quickPreviewResponseSchema.parse({
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
      }).tracks,
    ).toHaveLength(1);
  });

  it("rejects an empty preview", () => {
    expect(() =>
      quickPreviewResponseSchema.parse({
        projectId: "10000000-0000-4000-8000-000000000001",
        revisionId: "20000000-0000-4000-8000-000000000001",
        durationMs: 1_000,
        tracks: [],
      }),
    ).toThrow();
  });
});
