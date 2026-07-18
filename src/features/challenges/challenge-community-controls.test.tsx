import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChallengeVoteControl } from "./challenge-community-controls.client";

vi.mock("./community-actions", () => ({
  setChallengeVoteAction: vi.fn(),
  reportChallengeContentAction: vi.fn(),
}));

describe("challenge vote control", () => {
  it("announces the caller's active vote without exposing totals", () => {
    render(
      <ChallengeVoteControl
        entryId="30000000-0000-4000-8000-000000000001"
        slug="four-track-sprint"
        initiallyActive
      />,
    );
    expect(screen.getByRole("button", { name: "Your vote" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByText(/\d+\s+votes?/i)).not.toBeInTheDocument();
  });
});
