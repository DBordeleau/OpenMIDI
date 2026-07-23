import { cleanup, render, screen, within } from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { PublicProfileAward } from "@/features/awards/contract";
import { PublicProfileView } from "./public-profile";

const profile = {
  id: "10000000-0000-4000-8000-000000000001",
  username: "NightSignal",
  displayName: "Night Signal",
  creditName: "Night Signal",
  bio: "Late-night MIDI sketches with room for one more idea.",
  avatarConfig: null,
};

const award: PublicProfileAward = {
  id: "20000000-0000-4000-8000-000000000001",
  badgeDefinitionVersionId: "30000000-0000-4000-8000-000000000001",
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
  challengeResultId: "40000000-0000-4000-8000-000000000001",
  challengeEntryId: "50000000-0000-4000-8000-000000000001",
  projectRevisionId: "60000000-0000-4000-8000-000000000001",
  projectTitle: "Night Bus",
  revisionNumber: 3,
  challengeHref:
    "/challenges/four-track-sprint?result=40000000-0000-4000-8000-000000000001&entry=50000000-0000-4000-8000-000000000001#entry-50000000-0000-4000-8000-000000000001",
};

class TestIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly scrollMargin = "0px";
  readonly thresholds = [0];

  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
}

beforeAll(() => {
  vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
});

afterEach(cleanup);

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("public profile presentation", () => {
  it("organizes identity, published work, collaboration credit, and awards without invented social metrics", () => {
    render(
      <PublicProfileView
        profile={profile}
        projects={[
          {
            projectId: "70000000-0000-4000-8000-000000000001",
            title: "Midnight Discovery Signal",
            publishedAt: "2026-07-20T18:00:00.000Z",
            currentRevisionId: "71000000-0000-4000-8000-000000000001",
            durationMs: 8_000,
          },
        ]}
        contributions={[
          {
            revisionId: "80000000-0000-4000-8000-000000000001",
            revisionNumber: 4,
            projectId: "90000000-0000-4000-8000-000000000001",
            projectTitle: "Coral Counterpoint",
            acceptedAt: "2026-07-21T18:00:00.000Z",
            creditName: "Night Signal",
          },
        ]}
        awards={[award]}
        projectNextHref="/@NightSignal?projectsAfter=project-cursor"
        contributionNextHref="/@NightSignal?contributionsAfter=credit-cursor"
        awardNextHref="/@NightSignal?awardsAfter=award-cursor"
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Night Signal" }),
    ).toBeInTheDocument();
    expect(screen.getByText("@NightSignal")).toBeInTheDocument();
    expect(screen.getByText(profile.bio)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Report this profile" }),
    ).toHaveAttribute(
      "href",
      "/reports/new?kind=profile&id=10000000-0000-4000-8000-000000000001&label=%40NightSignal",
    );

    const work = screen.getByRole("region", {
      name: "Public Projects",
    });
    expect(
      within(work).getByRole("link", { name: "Midnight Discovery Signal" }),
    ).toHaveAttribute("href", "/projects/70000000-0000-4000-8000-000000000001");
    expect(
      within(work).getByRole("link", { name: "Next projects" }),
    ).toBeInTheDocument();

    const collaboration = screen.getByRole("region", {
      name: "Accepted Contributions",
    });
    expect(
      within(collaboration).getByRole("link", {
        name: "Coral Counterpoint",
      }),
    ).toHaveAttribute("href", "/projects/90000000-0000-4000-8000-000000000001");
    expect(within(collaboration).getByText("Revision 4")).toBeInTheDocument();

    const recognition = screen.getByRole("region", {
      name: "Trophy Case",
    });
    expect(
      within(recognition).getByRole("heading", {
        name: "Challenge Winner",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/followers|following|likes|XP|level/i),
    ).not.toBeInTheDocument();
    for (const removedLabel of [
      "Artist profile",
      "Body of work",
      "In the mix",
      "Published MIDI project",
      "Challenge recognition",
    ])
      expect(screen.queryByText(removedLabel)).not.toBeInTheDocument();
  });

  it("treats a sparse profile and stale cursor as deliberate, accessible states", () => {
    render(
      <PublicProfileView
        profile={{ ...profile, bio: null }}
        projects={[]}
        contributions={[]}
        awards={[]}
        projectNextHref={null}
        contributionNextHref={null}
        awardNextHref={null}
        cursorStale
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing the newest results.",
    );
    expect(
      screen.getByRole("heading", { name: "The set list is still open." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "No accepted contributions yet.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Awards earned in completed challenges will appear here.",
      ),
    ).toBeInTheDocument();
  });
});
