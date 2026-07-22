import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireViewer } from "@/features/auth/guards";
import { listProjectsForViewer } from "@/server/repositories/projects";
import ProjectsPage from "./page";

vi.mock("@/features/auth/guards", () => ({ requireViewer: vi.fn() }));
vi.mock("@/server/repositories/projects", () => ({
  listProjectsForViewer: vi.fn(),
}));
vi.mock("@/features/moderation/actions", () => ({
  restoreProjectAction: vi.fn(),
}));
vi.mock("@/components/ui/reveal.client", () => ({
  Reveal: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("next/link", () => ({
  default: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: unknown }) => (
    <a
      {...props}
      data-prefetch={
        prefetch === false
          ? "false"
          : prefetch === null
            ? "default"
            : "unspecified"
      }
    />
  ),
}));

afterEach(cleanup);

describe("project-index content-link prefetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireViewer).mockResolvedValue({ id: "viewer" } as never);
  });

  it("starts repeated project and Studio destinations cold", async () => {
    vi.mocked(listProjectsForViewer).mockResolvedValue({
      projects: [
        {
          id: "owner-project",
          title: "Owner project",
          description: "An editable project.",
          status: "active",
          role: "owner",
          currentRevisionId: null,
          updatedAt: "2026-07-19T12:00:00.000Z",
          needsReview: false,
          studioAccess: "workspace_available",
        },
        {
          id: "viewer-project",
          title: "Viewer project",
          description: null,
          status: "active",
          role: "viewer",
          currentRevisionId: null,
          updatedAt: "2026-07-18T12:00:00.000Z",
          needsReview: false,
          studioAccess: "read_only",
        },
      ],
      nextCursor: "next-page",
    });

    render(await ProjectsPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen
        .getAllByRole("link")
        .every((link) => link.getAttribute("data-prefetch") === "false"),
    ).toBe(true);
    // The card title is the only link to the project now — the row itself is
    // the destination, so a separate "Open project" button would be the same
    // door twice.
    expect(
      screen
        .getAllByRole("link")
        .filter(
          (link) => link.getAttribute("href") === "/projects/owner-project",
        ),
    ).toHaveLength(1);
    expect(
      screen
        .getAllByRole("link")
        .filter(
          (link) => link.getAttribute("href") === "/projects/viewer-project",
        ),
    ).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: "Open in studio" }),
    ).toHaveAttribute("href", "/studio/owner-project");
    expect(
      screen.getAllByRole("link", { name: "Open in studio" }),
    ).toHaveLength(1);

    const ownerProject = screen.getByRole("link", { name: "Owner project" });
    fireEvent.pointerEnter(ownerProject);
    expect(ownerProject).toHaveAttribute("data-prefetch", "default");
    expect(
      screen.getByRole("link", { name: "Viewer project" }),
    ).toHaveAttribute("data-prefetch", "false");
  });

  it("disables viewport prefetch for the empty-state actions", async () => {
    vi.mocked(listProjectsForViewer).mockResolvedValue({
      projects: [],
      nextCursor: null,
    });

    render(await ProjectsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("link", { name: "New project" })).toHaveAttribute(
      "data-prefetch",
      "false",
    );
    expect(
      screen.getByRole("link", { name: "Create your first project" }),
    ).toHaveAttribute("data-prefetch", "false");
  });
});
