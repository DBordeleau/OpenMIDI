import { describe, expect, it } from "vitest";
import {
  MAX_SOURCE_BYTES,
  preflightSourceFile,
  confirmAssetCreditsSchema,
  sourceReservationSchema,
} from "./schema";
describe("source upload preflight", () => {
  it("accepts a plausible WAV header", async () => {
    const file = new File(
      [new TextEncoder().encode("RIFF0000WAVEfmt ")],
      "stem.wav",
      { type: "audio/wav" },
    );
    await expect(preflightSourceFile(file)).resolves.toMatchObject({
      filename: "stem.wav",
      byteSize: 16,
    });
  });
  it("rejects deceptive and oversize input", async () => {
    await expect(
      preflightSourceFile(new File(["not audio"], "stem.wav")),
    ).rejects.toThrow("header");
    expect(
      sourceReservationSchema.safeParse({
        requestId: crypto.randomUUID(),
        byteSize: MAX_SOURCE_BYTES + 1,
        filename: "x.wav",
        mediaType: null,
        durationMs: null,
      }).success,
    ).toBe(false);
  });
});

describe("credit confirmation", () => {
  it("accepts ordered self and external credits", () => {
    expect(
      confirmAssetCreditsSchema.safeParse({
        assetId: crypto.randomUUID(),
        requestId: crypto.randomUUID(),
        credits: [
          { kind: "self", role: "creator" },
          { kind: "external", role: "performer", creditName: "Guest" },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects missing creators and normalized duplicates", () => {
    const base = {
      assetId: crypto.randomUUID(),
      requestId: crypto.randomUUID(),
    };
    expect(
      confirmAssetCreditsSchema.safeParse({
        ...base,
        credits: [{ kind: "external", role: "performer", creditName: "Guest" }],
      }).success,
    ).toBe(false);
    expect(
      confirmAssetCreditsSchema.safeParse({
        ...base,
        credits: [
          { kind: "self", role: "creator" },
          { kind: "external", role: "performer", creditName: "Guest" },
          { kind: "external", role: "performer", creditName: "guest" },
        ],
      }).success,
    ).toBe(false);
  });
});
