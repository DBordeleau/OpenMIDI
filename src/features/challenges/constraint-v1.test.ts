import { describe, expect, it } from "vitest";
import {
  canonicalizeChallengeConstraintsV1,
  challengeConstraintHashInput,
  describeChallengeConstraintsV1,
} from "./constraint-v1";

const complete = {
  schemaVersion: 1 as const,
  trackCount: { minimum: null, maximum: null, exact: 4 },
  distinctInstrumentCount: { minimum: 2, maximum: 4, exact: null },
  instruments: {
    allowedPresetVersions: [
      { presetId: "warm-keys", version: 1 },
      { presetId: "analog-bass", version: 1 },
    ],
    requiredPresetVersions: [],
    allowedFamilies: ["keys", "basses"],
    requiredFamilies: ["basses"],
  },
  tempoBpm: { minimum: 90, maximum: 110, exact: null },
  timeSignature: { numerator: 4, denominator: 4 },
  musicalKey: "c-minor",
};

describe("challenge constraint v1", () => {
  it("shares the manifest-v3 300 BPM ceiling", () => {
    expect(
      canonicalizeChallengeConstraintsV1({
        schemaVersion: 1,
        tempoBpm: { minimum: null, maximum: null, exact: 300 },
      }).tempoBpm?.exact,
    ).toBe(300);
    expect(() =>
      canonicalizeChallengeConstraintsV1({
        schemaVersion: 1,
        tempoBpm: { minimum: null, maximum: null, exact: 300.001 },
      }),
    ).toThrow();
  });

  it("accepts and describes every supported rule", () => {
    const canonical = canonicalizeChallengeConstraintsV1(complete);
    expect(canonical.instruments?.allowedPresetVersions[0]?.presetId).toBe(
      "analog-bass",
    );
    expect(describeChallengeConstraintsV1(canonical)).toEqual([
      "Use 4 tracks.",
      "Use 2–4 distinct instruments.",
      "Every track must use one of: Analog Bass v1, Warm Keys v1, basses, keys.",
      "Include each of: basses.",
      "Set the tempo to 90–110 BPM.",
      "Use a 4/4 time signature.",
      "Declare the project key as C minor.",
    ]);
  });

  it.each([
    [{ schemaVersion: 1, surprise: true }, "unrecognized_keys"],
    [
      { schemaVersion: 1, trackCount: { minimum: 5, maximum: 2, exact: null } },
      "range",
    ],
    [
      {
        schemaVersion: 1,
        tempoBpm: { minimum: null, maximum: null, exact: 120.1234 },
      },
      "precision",
    ],
    [
      { schemaVersion: 1, timeSignature: { numerator: 4, denominator: 3 } },
      "meter",
    ],
    [{ schemaVersion: 1, musicalKey: "h-major" }, "key"],
    [{ schemaVersion: 1 }, "zero rules"],
    [
      {
        schemaVersion: 1,
        instruments: {
          allowedPresetVersions: [
            { presetId: "warm-keys", version: 1 },
            { presetId: "warm-keys", version: 1 },
          ],
          requiredPresetVersions: [],
          allowedFamilies: [],
          requiredFamilies: [],
        },
      },
      "duplicate preset",
    ],
    [
      {
        schemaVersion: 1,
        instruments: {
          allowedPresetVersions: [],
          requiredPresetVersions: [],
          allowedFamilies: ["keys", "keys"],
          requiredFamilies: [],
        },
      },
      "duplicate family",
    ],
  ])("rejects invalid %s (%s)", (input, label) => {
    expect(
      () => canonicalizeChallengeConstraintsV1(input),
      `expected ${label} to be rejected`,
    ).toThrow();
  });

  it("produces identical hash input regardless of array and object input order", () => {
    const reordered = {
      musicalKey: "c-minor",
      timeSignature: { denominator: 4, numerator: 4 },
      tempoBpm: { exact: null, maximum: 110, minimum: 90 },
      instruments: {
        requiredFamilies: ["basses"],
        allowedFamilies: ["basses", "keys"],
        requiredPresetVersions: [],
        allowedPresetVersions: [
          { version: 1, presetId: "analog-bass" },
          { version: 1, presetId: "warm-keys" },
        ],
      },
      distinctInstrumentCount: { exact: null, maximum: 4, minimum: 2 },
      trackCount: { exact: 4, maximum: null, minimum: null },
      schemaVersion: 1,
    };
    expect(challengeConstraintHashInput(reordered)).toBe(
      challengeConstraintHashInput(complete),
    );
  });
});
