import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AdminChallengeResults } from "@/server/repositories/challenges";
import { AdminChallengeResultsPanel } from "./admin-results-panel.client";

vi.mock("./admin-results-actions", () => ({
  finalizeChallengeResultAction: vi.fn(),
  moderateChallengeTargetAction: vi.fn(),
  setFeaturedChallengeAction: vi.fn(),
}));

describe("AdminChallengeResultsPanel", () => {
  it("shows the private report target, reason, details, and timestamp", () => {
    const data = {
      challenge: {
        id: "10000000-0000-4000-8000-000000000001",
        slug: "reported-challenge",
        officialPlacementCount: 0,
        result: null,
        currentResultId: null,
        currentVersionId: "20000000-0000-4000-8000-000000000001",
        lifecycleVersion: 2,
        moderationState: "visible",
        moderationVersion: 1,
      },
      results: [],
      entries: [],
      votes: [],
      reports: [
        {
          reportId: "30000000-0000-4000-8000-000000000001",
          targetKind: "entry",
          entryId: "40000000-0000-4000-8000-000000000001",
          targetLabel: "Reported exact entry",
          reason: "vote_manipulation",
          details: "Several coordinated votes arrived together.",
          createdAt: "2026-07-18T20:00:00.000Z",
        },
      ],
      reportCount: 1,
      featuredSelection: { challengeId: null, version: 0 },
    } as unknown as AdminChallengeResults;

    render(<AdminChallengeResultsPanel data={data} />);

    expect(screen.getByText(/Entry: Reported exact entry/)).toBeVisible();
    expect(screen.getByText(/vote manipulation/)).toBeVisible();
    expect(
      screen.getByText("Several coordinated votes arrived together."),
    ).toBeVisible();
    expect(screen.getByText(/2026/)).toBeVisible();
  });
});
