import { describe, expect, it } from "vitest";
import { publicProfileAwardSchema } from "./contract";

const award = {
  id: "10000000-0000-4000-8000-000000000001",
  badgeDefinitionVersionId: "20000000-0000-4000-8000-000000000001",
  badgeCode: "challenge-winner",
  badgeName: "Challenge Winner",
  badgeDescription: "Awarded for the official first-place challenge entry.",
  earnedMessage: "Your arrangement took the top official spot.",
  presentationCode: "trophy",
  awardBasis: "official_winner",
  place: 1,
  placementLabel: "Winner",
  awardedAt: "2026-07-18T21:00:00.000Z",
  challengeSlug: "four-track-sprint",
  challengeTitle: "Four Track Sprint",
  challengeResultId: "30000000-0000-4000-8000-000000000001",
  challengeEntryId: "40000000-0000-4000-8000-000000000001",
  projectRevisionId: "50000000-0000-4000-8000-000000000001",
  projectTitle: "Night Bus",
  revisionNumber: 3,
  challengeHref:
    "/challenges/four-track-sprint?result=30000000-0000-4000-8000-000000000001&entry=40000000-0000-4000-8000-000000000001#entry-40000000-0000-4000-8000-000000000001",
} as const;

describe("public profile award contract", () => {
  it("accepts the exact immutable result and entry source shape", () => {
    expect(publicProfileAwardSchema.parse(award)).toMatchObject(award);
  });

  it.each([
    { awardBasis: "official_winner", place: 2 },
    {
      awardBasis: "community_favorite",
      place: 1,
      placementLabel: "Favorite",
    },
    { awardBasis: "top_placement", place: null },
    { challengeHref: "/challenges/four-track-sprint" },
    { presentationCode: "uploaded-svg" },
  ])(
    "rejects a malformed basis, placement, presentation, or source",
    (patch) => {
      expect(
        publicProfileAwardSchema.safeParse({ ...award, ...patch }).success,
      ).toBe(false);
    },
  );
});
