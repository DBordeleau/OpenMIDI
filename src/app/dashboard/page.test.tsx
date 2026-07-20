import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireViewer } from "@/features/auth/guards";
import { getViewerDashboard } from "@/server/repositories/dashboard";
import { assertViewerAdmin } from "@/server/repositories/moderation";
import { getFeaturedChallenge } from "@/server/repositories/challenges";
import DashboardPage from "./page";

vi.mock("@/features/auth/guards", () => ({ requireViewer: vi.fn() }));
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
vi.mock("@/server/repositories/dashboard", () => ({
  getViewerDashboard: vi.fn(),
}));
vi.mock("@/server/repositories/moderation", () => ({
  assertViewerAdmin: vi.fn(),
}));
vi.mock("@/server/repositories/challenges", () => ({
  getFeaturedChallenge: vi.fn(),
}));
vi.mock("@/features/invitations/admin-invite-form.client", () => ({
  AdminInviteForm: () => <div data-testid="admin-invite-form" />,
}));
vi.mock("@/components/ui/reveal.client", () => ({
  Reveal: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const dashboard = {
  ownedProjects: [],
  activeWorkspaces: [],
  pendingContributions: [],
  review: { count: 0, hasMore: false },
};

afterEach(cleanup);

describe("dashboard administrator invitation visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireViewer).mockResolvedValue({ id: "viewer" } as never);
    vi.mocked(getViewerDashboard).mockResolvedValue(dashboard);
    vi.mocked(getFeaturedChallenge).mockResolvedValue(null);
  });

  it("renders the invitation card for a database-verified administrator", async () => {
    vi.mocked(assertViewerAdmin).mockResolvedValue(true);
    render(await DashboardPage());
    expect(
      screen.getByRole("heading", { name: "Invite a collaborator" }),
    ).toBeVisible();
    expect(screen.getByTestId("admin-invite-form")).toBeInTheDocument();
  });

  it("does not render the invitation card for a normal member", async () => {
    vi.mocked(assertViewerAdmin).mockResolvedValue(false);
    render(await DashboardPage());
    expect(
      screen.queryByRole("heading", { name: "Invite a collaborator" }),
    ).not.toBeInTheDocument();
  });
});

describe("dashboard content-link prefetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireViewer).mockResolvedValue({ id: "viewer" } as never);
    vi.mocked(assertViewerAdmin).mockResolvedValue(true);
    vi.mocked(getFeaturedChallenge).mockResolvedValue({
      label: "Featured challenge",
      challenge: {
        slug: "one-note-sprint",
        title: "One-note sprint",
        prompt: "Build momentum from one pitch.",
      },
    } as never);
    vi.mocked(getViewerDashboard).mockResolvedValue({
      ownedProjects: [
        {
          projectId: "owned-project",
          title: "Owned project",
          status: "active",
          currentRevisionId: "revision",
          updatedAt: "2026-07-19T12:00:00.000Z",
        },
      ],
      activeWorkspaces: [
        {
          workspaceId: "workspace",
          projectId: "workspace-project",
          projectTitle: "Workspace project",
          contributionId: null,
          contributionTitle: null,
          lockVersion: 1,
          updatedAt: "2026-07-19T12:00:00.000Z",
          archivesAt: "2026-08-18T12:00:00.000Z",
          archiveWarning: false,
        },
        {
          workspaceId: "contribution-workspace",
          projectId: "collaboration-project",
          projectTitle: "Collaboration project",
          contributionId: "workspace-contribution",
          contributionTitle: "Workspace contribution",
          lockVersion: 2,
          updatedAt: "2026-07-19T12:00:00.000Z",
          archivesAt: "2026-08-18T12:00:00.000Z",
          archiveWarning: false,
        },
      ],
      pendingContributions: [
        {
          contributionId: "pending-contribution",
          projectId: "pending-project",
          projectTitle: "Pending project",
          title: "Pending contribution",
          status: "submitted",
          currentVersionNumber: 1,
          updatedAt: "2026-07-19T12:00:00.000Z",
        },
      ],
      review: { count: 3, hasMore: false },
    });
  });

  it("starts every populated dashboard destination cold and warms after intent", async () => {
    render(await DashboardPage());

    expect(
      screen
        .getAllByRole("link")
        .every((link) => link.getAttribute("data-prefetch") === "false"),
    ).toBe(true);
    expect(
      screen.getByRole("link", { name: /Open featured challenge/ }),
    ).toHaveAttribute("href", "/challenges/one-note-sprint");
    expect(screen.getByRole("link", { name: "Owned project" })).toHaveAttribute(
      "href",
      "/projects/owned-project",
    );
    expect(
      screen.getByRole("link", { name: "Workspace project" }),
    ).toHaveAttribute("href", "/studio/workspace-project");
    expect(
      screen.getByRole("link", { name: "Workspace contribution" }),
    ).toHaveAttribute(
      "href",
      "/projects/collaboration-project/contributions/workspace-contribution",
    );

    fireEvent.focus(screen.getByRole("link", { name: "Owned project" }));
    expect(screen.getByRole("link", { name: "Owned project" })).toHaveAttribute(
      "data-prefetch",
      "default",
    );
  });

  it("keeps dashboard empty-state destinations cold", async () => {
    vi.mocked(getViewerDashboard).mockResolvedValue(dashboard);
    vi.mocked(getFeaturedChallenge).mockResolvedValue(null);
    render(await DashboardPage());

    for (const name of [
      /Create a project/,
      /Open your projects/,
      /Explore open projects/,
      /Browse challenges/,
    ])
      expect(screen.getByRole("link", { name })).toHaveAttribute(
        "data-prefetch",
        "false",
      );
  });
});
