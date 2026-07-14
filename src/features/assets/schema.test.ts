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
      format: "wav",
    });
  });
  it("passes accepted FLAC and MP3 bytes through without rewriting them", async () => {
    const flacBytes = new Uint8Array([0x66, 0x4c, 0x61, 0x43, 1, 2, 3]);
    const mp3Bytes = new Uint8Array([0x49, 0x44, 0x33, 4, 5, 6]);
    const flac = new File([flacBytes], "stem.flac", { type: "audio/flac" });
    const mp3 = new File([mp3Bytes], "stem.mp3", { type: "audio/mpeg" });

    await expect(preflightSourceFile(flac)).resolves.toMatchObject({
      format: "flac",
      byteSize: flacBytes.byteLength,
    });
    await expect(preflightSourceFile(mp3)).resolves.toMatchObject({
      format: "mp3",
      byteSize: mp3Bytes.byteLength,
    });
    expect(new Uint8Array(await flac.arrayBuffer())).toEqual(flacBytes);
    expect(new Uint8Array(await mp3.arrayBuffer())).toEqual(mp3Bytes);
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
