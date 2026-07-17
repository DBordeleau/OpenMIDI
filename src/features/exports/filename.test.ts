import { describe, expect, it } from "vitest";
import { buildMixFilename, sanitizeFilenamePart } from "./filename";

describe("export filenames", () => {
  it("sanitizes paths, device names, and empty labels", () => {
    expect(sanitizeFilenamePart(" ../Lead:* ", "stem")).toBe("Lead-");
    expect(sanitizeFilenamePart("CON", "stem")).toBe("_CON");
    expect(sanitizeFilenamePart("...", "stem")).toBe("stem");
  });

  it("builds revision and draft mix names", () => {
    expect(
      buildMixFilename({ projectTitle: "My / Jam", revisionNumber: 2 }),
    ).toBe("My - Jam-r2-mix.wav");
    expect(buildMixFilename({ projectTitle: "Jam" })).toBe("Jam-draft-mix.wav");
  });
});
