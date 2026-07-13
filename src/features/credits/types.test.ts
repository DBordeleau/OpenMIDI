import { describe, expect, it } from "vitest";
import { aggregateCredits, type CreditSnapshot } from "./types";

const credit = (
  creditName: string,
  role: CreditSnapshot["role"],
  position: number,
): CreditSnapshot => ({ creditName, role, position, profileUsername: null });

describe("credit aggregation", () => {
  it("keeps first occurrence order and distinct roles", () => {
    expect(
      aggregateCredits([
        {
          credits: [
            credit("Alex", "creator", 0),
            credit("Alex", "performer", 1),
          ],
        },
        {
          credits: [credit("alex", "creator", 0), credit("Sam", "producer", 1)],
        },
      ]).map(({ creditName, role }) => [creditName, role]),
    ).toEqual([
      ["Alex", "creator"],
      ["Alex", "performer"],
      ["Sam", "producer"],
    ]);
  });
});
