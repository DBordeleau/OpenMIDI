import { describe, expect, it } from "vitest";
import {
  assertMixExportWithinLimits,
  estimateStereoWavBytes,
} from "./mix-export";

describe("mix export bounds", () => {
  it("estimates stereo 16-bit PCM plus its header", () => {
    expect(estimateStereoWavBytes(1, 48_000)).toBe(192_044);
  });

  it("accepts the MVP duration boundary and rejects longer arrangements", () => {
    expect(assertMixExportWithinLimits(600, 44_100)).toBeGreaterThan(44);
    expect(() => assertMixExportWithinLimits(601, 44_100)).toThrow(
      "mix_export_too_large",
    );
  });
});
