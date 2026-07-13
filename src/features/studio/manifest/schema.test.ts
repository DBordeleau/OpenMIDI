import { describe, expect, it } from "vitest";
import { STUDIO_FIXTURE_MANIFEST } from "./fixtures";
import { parseWorkspaceManifest } from "./schema";

describe("workspace manifest v1", () => {
  it("parses and canonicalizes the fixture", () => {
    expect(parseWorkspaceManifest(STUDIO_FIXTURE_MANIFEST)).toEqual(
      STUDIO_FIXTURE_MANIFEST,
    );
  });

  it.each([
    ["unknown field", { extra: true }],
    ["invalid tempo", { tempoBpm: 0 }],
  ])("rejects %s", (_name, patch) => {
    expect(() =>
      parseWorkspaceManifest({ ...STUDIO_FIXTURE_MANIFEST, ...patch }),
    ).toThrow();
  });

  it.each([
    ["negative position", { positionMs: -1 }],
    ["zero duration", { durationMs: 0 }],
    ["invalid pan", { pan: 2 }],
    ["invalid gain", { gainDb: -61 }],
    ["NaN", { gainDb: Number.NaN }],
    ["infinity", { pan: Number.POSITIVE_INFINITY }],
    ["unknown track field", { surprise: true }],
  ])("rejects %s", (_name, patch) => {
    const tracks = [{ ...STUDIO_FIXTURE_MANIFEST.tracks[0], ...patch }];
    expect(() =>
      parseWorkspaceManifest({ ...STUDIO_FIXTURE_MANIFEST, tracks }),
    ).toThrow();
  });

  it.each(["trackId", "assetId", "sortOrder"] as const)(
    "rejects duplicate %s",
    (key) => {
      const [first, second] = STUDIO_FIXTURE_MANIFEST.tracks;
      expect(() =>
        parseWorkspaceManifest({
          ...STUDIO_FIXTURE_MANIFEST,
          tracks: [first, { ...second, [key]: first[key] }],
        }),
      ).toThrow(`Duplicate ${key}`);
    },
  );

  it("sorts tracks by their unique persisted order", () => {
    const reversed = {
      ...STUDIO_FIXTURE_MANIFEST,
      tracks: [...STUDIO_FIXTURE_MANIFEST.tracks].reverse(),
    };
    expect(parseWorkspaceManifest(reversed)).toEqual(STUDIO_FIXTURE_MANIFEST);
  });
});
