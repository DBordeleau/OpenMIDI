import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PublicProfileAward } from "./contract";
import { TrophyCase } from "./trophy-case";

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
    badgeName: `Challenge Winner ${id}`,
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

describe("TrophyCase", () => {
  afterEach(cleanup);

  it("keeps award basis and exact result links in compact items", () => {
    const awards = [
      makeAward(1),
      makeAward(2, {
        badgeCode: "community-favorite",
        badgeName: "Community Favorite",
        presentationCode: "favorite",
        awardBasis: "community_favorite",
        place: null,
        placementLabel: null,
      }),
      makeAward(3, {
        badgeCode: "top-placement",
        badgeName: "Top Placement",
        presentationCode: "placement",
        awardBasis: "top_placement",
        place: 2,
        placementLabel: "Runner-up",
      }),
    ];

    render(
      <TrophyCase awards={awards} nextHref="/@beatmaker?awardsAfter=next" />,
    );

    expect(
      screen.getByRole("region", { name: "Trophy Case" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Official winner · Winner")).toBeVisible();
    expect(
      screen.getByText("Highest final community vote total"),
    ).toBeVisible();
    expect(screen.getByText("Official placement #2 · Runner-up")).toBeVisible();
    expect(
      screen.getByRole("link", {
        name: "Challenge Winner 1 for Four Track Sprint: Official winner · Winner. View permanent result",
      }),
    ).toHaveAttribute("href", awards[0]!.challengeHref);
    expect(screen.getByRole("link", { name: "Next awards" })).toHaveAttribute(
      "href",
      "/@beatmaker?awardsAfter=next",
    );
    expect(
      screen.queryByText(`${awards.length} earned`),
    ).not.toBeInTheDocument();
  });

  it("discloses every award beyond the compact first set", () => {
    render(
      <TrophyCase
        awards={[makeAward(1), makeAward(2), makeAward(3), makeAward(4)]}
        nextHref={null}
      />,
    );

    expect(screen.getByText("Show 1 more award")).toBeVisible();
    fireEvent.click(screen.getByText("Show 1 more award"));
    expect(
      screen.getByRole("heading", { name: "Challenge Winner 4" }),
    ).toBeVisible();
  });

  it("keeps the empty trophy state restrained", () => {
    render(<TrophyCase awards={[]} nextHref={null} />);
    expect(
      screen.getByText(
        "Awards earned in completed challenges will appear here.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });
});
