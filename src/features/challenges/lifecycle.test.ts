import { describe, expect, it } from "vitest";
import {
  challengePhaseMessage,
  deriveChallengePhase,
  isChallengePubliclyAddressable,
} from "./lifecycle";

const schedule = {
  opensAt: "2026-08-01T12:00:00.000Z",
  submissionsCloseAt: "2026-08-08T12:00:00.000Z",
  votingOpensAt: "2026-08-09T12:00:00.000Z",
  votingClosesAt: "2026-08-10T12:00:00.000Z",
};

describe("challenge lifecycle", () => {
  it.each([
    ["2026-08-01T11:59:59.999Z", "scheduled"],
    ["2026-08-01T12:00:00.000Z", "open"],
    ["2026-08-08T12:00:00.000Z", "voting"],
  ] as const)("derives the exact boundary at %s", (now, expected) => {
    expect(deriveChallengePhase({ state: "published", ...schedule, now })).toBe(
      expected,
    );
  });

  it("labels the voting gap and post-close wait honestly", () => {
    expect(
      challengePhaseMessage({
        phase: "voting",
        ...schedule,
        now: "2026-08-08T12:00:00.000Z",
      }),
    ).toBe("Voting opens soon");
    expect(
      challengePhaseMessage({
        phase: "voting",
        ...schedule,
        now: "2026-08-10T12:00:00.000Z",
      }),
    ).toBe("Results pending");
  });

  it("honors explicit terminal states regardless of time", () => {
    expect(deriveChallengePhase({ state: "completed", ...schedule })).toBe(
      "completed",
    );
    expect(deriveChallengePhase({ state: "cancelled", ...schedule })).toBe(
      "cancelled",
    );
  });

  it("exposes a public link only after a challenge has been published", () => {
    expect(isChallengePubliclyAddressable({ publishedAt: null })).toBe(false);
    expect(
      isChallengePubliclyAddressable({
        publishedAt: "2026-08-01T12:00:00.000Z",
      }),
    ).toBe(true);
  });
});
