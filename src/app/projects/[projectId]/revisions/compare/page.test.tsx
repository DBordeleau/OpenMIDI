import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { getProjectRevisionComparison } from "@/server/repositories/project-revision-comparisons";
import ProjectRevisionComparisonPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
}));
vi.mock("@/server/repositories/project-revision-comparisons", () => ({
  getProjectRevisionComparison: vi.fn(),
}));
vi.mock("@/features/midi-diff/project-revision-comparison.client", () => ({
  ProjectRevisionComparisonView: () => <div>Shared diff surface</div>,
}));

const projectId = "61000000-0000-4000-8000-000000000001";
const from = "62000000-0000-4000-8000-000000000001";
const to = "62000000-0000-4000-8000-000000000002";

afterEach(cleanup);

describe("project revision comparison route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects a default selection to the reload-safe canonical pair", async () => {
    vi.mocked(redirect).mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    vi.mocked(getProjectRevisionComparison).mockResolvedValue({
      status: "ready",
      canonicalPair: { from, to },
      comparison: { project: { id: projectId, title: "Revision lab" } },
    } as never);
    await expect(
      ProjectRevisionComparisonPage({
        params: Promise.resolve({ projectId }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith(
      `/projects/${projectId}/revisions/compare?from=${from}&to=${to}`,
    );
  });

  it("renders the canonical pair with clear history navigation", async () => {
    vi.mocked(getProjectRevisionComparison).mockResolvedValue({
      status: "ready",
      canonicalPair: { from, to },
      comparison: { project: { id: projectId, title: "Revision lab" } },
    } as never);
    render(
      await ProjectRevisionComparisonPage({
        params: Promise.resolve({ projectId }),
        searchParams: Promise.resolve({ from, to }),
      }),
    );
    expect(screen.getByText("Shared diff surface")).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: /Back to project history/ }),
    ).toHaveLength(2);
  });

  it("renders an honest unavailable pair state", async () => {
    vi.mocked(getProjectRevisionComparison).mockResolvedValue({
      status: "unavailable",
      project: { id: projectId, title: "Revision lab" },
    });
    render(
      await ProjectRevisionComparisonPage({
        params: Promise.resolve({ projectId }),
        searchParams: Promise.resolve({ from, to }),
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Comparison unavailable" }),
    ).toBeVisible();
    expect(screen.getByText(/outside this project/)).toBeVisible();
  });
});
