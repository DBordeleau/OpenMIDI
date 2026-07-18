import { describe, expect, it } from "vitest";
import {
  challengeEvaluationV1Schema,
  evaluateChallengeConstraintsV1,
  type ChallengeFactsV1,
} from "./evaluate-constraint-v1";

const facts: ChallengeFactsV1 = {
  trackCount: 4,
  distinctInstrumentCount: 3,
  presetVersions: [
    { presetId: "analog-bass", version: 1 },
    { presetId: "warm-keys", version: 1 },
    { presetId: "warm-pad", version: 1 },
  ],
  families: ["basses", "keys", "pads-strings"],
  tempoBpm: 99.125,
  timeSignature: { numerator: 4, denominator: 4 },
  musicalKey: "c-minor",
};

const constraints = {
  schemaVersion: 1 as const,
  trackCount: { minimum: 4, maximum: 6, exact: null },
  distinctInstrumentCount: { minimum: null, maximum: null, exact: 3 },
  instruments: {
    allowedPresetVersions: [{ presetId: "warm-keys", version: 1 }],
    allowedFamilies: ["basses", "pads-strings"],
    requiredPresetVersions: [{ presetId: "warm-keys", version: 1 }],
    requiredFamilies: ["basses"],
  },
  tempoBpm: { minimum: 99.125, maximum: 100, exact: null },
  timeSignature: { numerator: 4, denominator: 4 },
  musicalKey: "c-minor",
};

describe("challenge constraint-v1 evaluation", () => {
  it("returns every configured rule in stable order with inclusive decimal bounds", () => {
    const result = evaluateChallengeConstraintsV1(constraints, facts);
    expect(result.eligible).toBe(true);
    expect(result.rules.map(({ rule }) => rule)).toEqual([
      "track_count",
      "distinct_instrument_count",
      "allowed_instruments",
      "required_instruments",
      "tempo_bpm",
      "time_signature",
      "musical_key",
    ]);
    expect(result.rules.every(({ passed }) => passed)).toBe(true);
    expect(result.facts.tempoBpm).toBe(99.125);
  });

  it("uses an allowed preset/family union and cumulative required semantics", () => {
    const result = evaluateChallengeConstraintsV1(constraints, {
      ...facts,
      presetVersions: [
        { presetId: "warm-keys", version: 1 },
        { presetId: "sub-bass", version: 1 },
        { presetId: "saw-lead", version: 1 },
      ],
      families: ["keys", "basses", "leads"],
    });
    expect(
      result.rules.find(({ rule }) => rule === "allowed_instruments"),
    ).toMatchObject({
      passed: false,
      message: "Change saw-lead v1 to an allowed preset version or family.",
    });
    expect(
      result.rules.find(({ rule }) => rule === "required_instruments")?.passed,
    ).toBe(true);
  });

  it("counts empty and muted tracks because facts describe arrangement structure", () => {
    const result = evaluateChallengeConstraintsV1(
      {
        schemaVersion: 1,
        trackCount: { minimum: null, maximum: null, exact: 4 },
      },
      facts,
    );
    expect(result.rules[0]).toMatchObject({ passed: true, observed: 4 });
  });

  it("distinguishes exact preset versions", () => {
    const result = evaluateChallengeConstraintsV1(
      {
        schemaVersion: 1,
        instruments: {
          allowedPresetVersions: [],
          allowedFamilies: [],
          requiredPresetVersions: [{ presetId: "warm-keys", version: 1 }],
          requiredFamilies: [],
        },
      },
      {
        ...facts,
        presetVersions: [{ presetId: "analog-bass", version: 1 }],
        families: ["basses"],
      },
    );
    expect(result.eligible).toBe(false);
    expect(result.rules[0].message).toContain("warm-keys v1");
  });

  it("reports null key without guessing from notes", () => {
    const result = evaluateChallengeConstraintsV1(
      { schemaVersion: 1, musicalKey: "c-minor" },
      { ...facts, musicalKey: null },
    );
    expect(result.rules[0]).toMatchObject({
      passed: false,
      observed: null,
      message: "Observed No key declared; declare the project key as C minor.",
    });
  });

  it("returns all actionable failures rather than stopping at the first", () => {
    const result = evaluateChallengeConstraintsV1(constraints, {
      ...facts,
      trackCount: 2,
      distinctInstrumentCount: 1,
      presetVersions: [{ presetId: "saw-lead", version: 1 }],
      families: ["leads"],
      tempoBpm: 120,
      timeSignature: { numerator: 3, denominator: 4 },
      musicalKey: null,
    });
    expect(result.eligible).toBe(false);
    expect(result.rules.filter(({ passed }) => !passed)).toHaveLength(7);
    expect(result.rules.every(({ message }) => message.length > 10)).toBe(true);
  });

  it("rejects malformed authoritative evaluation output", () => {
    expect(() =>
      challengeEvaluationV1Schema.parse({
        schemaVersion: 1,
        eligible: true,
        facts,
        rules: [
          {
            rule: "track_count",
            passed: false,
            observed: 4,
            required: {},
            message: "Mismatch",
          },
        ],
      }),
    ).toThrow(/Eligibility is inconsistent/);
    expect(() =>
      challengeEvaluationV1Schema.parse({
        schemaVersion: 1,
        eligible: true,
        facts,
        rules: [],
      }),
    ).toThrow();
  });
});
