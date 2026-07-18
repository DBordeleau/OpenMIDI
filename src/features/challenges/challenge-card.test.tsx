import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { canonicalizeChallengeConstraintsV1 } from "./constraint-v1";
import { ChallengeCard } from "./challenge-card";
import { ChallengeRules } from "./challenge-rules";
import type { Challenge } from "./types";

const challenge: Challenge = {
  id: "10000000-0000-4000-8000-000000000001",
  slug: "four-track-sprint",
  state: "published",
  phase: "open",
  acceptsVotes: false,
  lifecycleVersion: 2,
  currentVersionId: "20000000-0000-4000-8000-000000000001",
  versionNumber: 1,
  title: "Four Track Sprint",
  prompt: "Say more with four parts.",
  description: "A focused arrangement challenge.",
  eligibilityTerms: "Original work only.",
  presentationCode: "pulse",
  opensAt: "2026-08-01T12:00:00.000Z",
  submissionsCloseAt: "2026-08-08T12:00:00.000Z",
  votingOpensAt: "2026-08-09T12:00:00.000Z",
  votingClosesAt: "2026-08-10T12:00:00.000Z",
  resultsExpectedAt: "2026-08-11T12:00:00.000Z",
  judgingMode: "community",
  officialPlacementCount: 0,
  constraints: canonicalizeChallengeConstraintsV1({
    schemaVersion: 1,
    trackCount: { minimum: null, maximum: null, exact: 4 },
  }),
  constraintsSha256: "a".repeat(64),
  judges: [
    {
      position: 1,
      role: "host",
      displayName: "OpenMIDI",
      profileId: null,
      creditName: "OpenMIDI",
    },
  ],
  starter: null,
  publishedAt: "2026-07-20T12:00:00.000Z",
  completedAt: null,
  cancelledAt: null,
  cancellationNote: null,
  createdAt: "2026-07-19T12:00:00.000Z",
  updatedAt: "2026-07-20T12:00:00.000Z",
  moderationState: null,
  moderationVersion: null,
  currentResultId: null,
  result: null,
};

describe("public challenge presentation", () => {
  it("renders phase and rules without entry or voting actions", () => {
    render(
      <>
        <ChallengeCard challenge={challenge} />
        <ChallengeRules constraints={challenge.constraints} />
      </>,
    );
    expect(screen.getByRole("link", { name: challenge.title })).toHaveAttribute(
      "href",
      `/challenges/${challenge.slug}`,
    );
    expect(screen.getByText("Use 4 tracks.")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /enter|submit|vote/i }),
    ).not.toBeInTheDocument();
  });
});
