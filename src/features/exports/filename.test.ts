import { describe, expect, it } from "vitest";
import {
  buildMixFilename,
  buildStemFilenames,
  sanitizeFilenamePart,
  sourceExtension,
} from "./filename";

describe("export filenames", () => {
  it("sanitizes paths, device names, and empty labels", () => {
    expect(sanitizeFilenamePart(" ../Lead:* ", "stem")).toBe("Lead-");
    expect(sanitizeFilenamePart("CON", "stem")).toBe("_CON");
    expect(sanitizeFilenamePart("...", "stem")).toBe("stem");
  });

  it("uses verified formats and deterministic ordering", () => {
    expect(sourceExtension("audio/mpeg")).toBe("mp3");
    expect(
      buildStemFilenames([
        {
          assetId: "00000000-0000-4000-8000-000000000001",
          name: "Lead",
          mediaType: "audio/wav",
          sortOrder: 0,
        },
        {
          assetId: "00000000-0000-4000-8000-000000000002",
          name: "Lead",
          mediaType: "audio/flac",
          sortOrder: 1,
        },
      ]),
    ).toEqual(["01-Lead.wav", "02-Lead.flac"]);
  });

  it("builds revision and draft mix names", () => {
    expect(
      buildMixFilename({ projectTitle: "My / Jam", revisionNumber: 2 }),
    ).toBe("My - Jam-r2-mix.wav");
    expect(buildMixFilename({ projectTitle: "Jam" })).toBe("Jam-draft-mix.wav");
  });
});
