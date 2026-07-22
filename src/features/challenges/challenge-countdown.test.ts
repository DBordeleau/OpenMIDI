import { describe, expect, it } from "vitest";
import { formatRemaining } from "./challenge-countdown";

const now = Date.parse("2026-08-01T12:00:00.000Z");

describe("challenge countdown presentation", () => {
  it.each([
    [90 * 60 * 1000, { value: 1, unit: "hour" }],
    [2 * 60 * 60 * 1000, { value: 2, unit: "hours" }],
    [60 * 1000, { value: 1, unit: "minute" }],
    [15 * 60 * 1000, { value: 15, unit: "minutes" }],
  ])(
    "formats %i milliseconds with grammatical units",
    (remaining, expected) => {
      expect(
        formatRemaining(new Date(now + remaining).toISOString(), now),
      ).toEqual(expected);
    },
  );

  it("returns no countdown after the milestone", () => {
    expect(formatRemaining(new Date(now).toISOString(), now)).toBeNull();
  });
});
