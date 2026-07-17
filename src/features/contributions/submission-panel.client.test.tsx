import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { submitContributionAction } from "./actions";
import { SubmissionPanel } from "./submission-panel.client";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));
vi.mock("./actions", () => ({
  submitContributionAction: vi.fn(),
}));

describe("SubmissionPanel", () => {
  it("refreshes contribution data without a full document reload", async () => {
    vi.mocked(submitContributionAction).mockResolvedValue({
      ok: true,
      versionNumber: 1,
    });
    render(
      <SubmissionPanel
        projectId="10000000-0000-4000-8000-000000000123"
        contributionId="20000000-0000-4000-8000-000000000123"
        baseRevisionId="30000000-0000-4000-8000-000000000123"
        workspace={{
          lockVersion: 2,
          manifestSha256: "a".repeat(64),
          updatedAt: "2026-07-17T00:00:00.000Z",
          trackCount: 1,
          durationMs: 2000,
          hasAcknowledgedSave: true,
        }}
        license={{
          name: "CC BY 4.0",
          url: "https://creativecommons.org/licenses/by/4.0/",
          summary: "Reuse with attribution.",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(
      screen.getByRole("button", { name: "Submit immutable version" }),
    );

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });
});
