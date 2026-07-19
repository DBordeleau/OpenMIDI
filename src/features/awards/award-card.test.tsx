import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AwardGallery } from "./award-gallery";
import type { PublicProfileAward } from "./contract";

function makeAward(
  id: number,
  patch: Partial<PublicProfileAward> = {},
): PublicProfileAward {
  const entryId = `40000000-0000-4000-8000-${id.toString().padStart(12, "0")}`;
  const resultId = "30000000-0000-4000-8000-000000000001";
  return {
    id: `10000000-0000-4000-8000-${id.toString().padStart(12, "0")}`,
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
    challengeResultId: resultId,
    challengeEntryId: entryId,
    projectRevisionId: `50000000-0000-4000-8000-${id.toString().padStart(12, "0")}`,
    projectTitle: "Night Bus",
    revisionNumber: 3,
    challengeHref: `/challenges/four-track-sprint?result=${resultId}&entry=${entryId}#entry-${entryId}`,
    ...patch,
  };
}

describe("profile award cards", () => {
  it("renders Winner, Community Favorite, Top Placement, and a dual award as independent accessible sources", () => {
    const winner = makeAward(1);
    const favorite = makeAward(2, {
      badgeDefinitionVersionId: "20000000-0000-4000-8000-000000000002",
      badgeCode: "community-favorite",
      badgeName: "Community Favorite",
      presentationCode: "favorite",
      awardBasis: "community_favorite",
      place: null,
      placementLabel: null,
      earnedMessage: "Listeners made this arrangement a community favorite.",
    });
    const top = makeAward(3, {
      badgeDefinitionVersionId: "20000000-0000-4000-8000-000000000003",
      badgeCode: "top-placement",
      badgeName: "Top Placement",
      presentationCode: "placement",
      awardBasis: "top_placement",
      place: 2,
      placementLabel: "Runner-up",
    });
    const dualFavorite = {
      ...favorite,
      id: "10000000-0000-4000-8000-000000000004",
      challengeEntryId: winner.challengeEntryId,
      challengeHref: winner.challengeHref,
    };
    render(
      <AwardGallery
        awards={[winner, favorite, top, dualFavorite]}
        nextHref="/@beatmaker?awardsAfter=next"
      />,
    );
    expect(screen.getAllByRole("article")).toHaveLength(4);
    expect(screen.getByText("Official winner · Winner")).toBeVisible();
    expect(
      screen.getAllByText("Highest final community vote total"),
    ).toHaveLength(2);
    expect(screen.getByText("Official placement #2 · Runner-up")).toBeVisible();
    expect(
      screen.getByRole("link", {
        name: "Challenge Winner for Four Track Sprint: Official winner · Winner",
      }),
    ).toHaveAttribute("href", winner.challengeHref);
    expect(screen.getByRole("link", { name: "Next awards" })).toHaveAttribute(
      "href",
      "/@beatmaker?awardsAfter=next",
    );
    expect(
      screen.queryByText(/XP|rarity|global rank|streak/i),
    ).not.toBeInTheDocument();
  });

  it("shows a useful empty state when hidden or absent awards are excluded", () => {
    cleanup();
    render(<AwardGallery awards={[]} nextHref={null} />);
    expect(screen.getByRole("heading", { name: "Awards" })).toBeVisible();
    expect(screen.getByText(/No current challenge awards yet/)).toBeVisible();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });
});
