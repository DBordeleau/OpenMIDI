import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireViewer } from "@/features/auth/guards";
import type { DashboardData } from "@/features/dashboard/types";
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

const emptyCount = { count: 0, hasMore: false };
const dashboard: DashboardData = {
  ownedProjects: [],
  activeWorkspaces: [],
  pendingContributions: [],
  review: emptyCount,
  resume: null,
  recentClips: [],
  counts: {
    projects: emptyCount,
    clips: emptyCount,
    savedClips: emptyCount,
    pendingContributions: emptyCount,
    archivingSoon: emptyCount,
  },
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

describe("dashboard launcher", () => {
  const populated: DashboardData = {
    ownedProjects: [
      {
        projectId: "owned-project",
        title: "Owned project",
        status: "active",
        currentRevisionId: "revision",
        revisionNumber: 2,
        trackCount: 3,
        reviewCount: 3,
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
    resume: {
      workspaceId: "workspace",
      projectId: "workspace-project",
      projectTitle: "Workspace project",
      contributionId: null,
      contributionTitle: null,
      updatedAt: "2026-07-19T12:00:00.000Z",
      lockVersion: 1,
      tempoBpm: 118,
      durationTicks: 7680,
      musicalKey: "d-minor",
      timeSignatureNumerator: 4,
      timeSignatureDenominator: 4,
      tracks: [
        {
          trackId: "track-1",
          sortOrder: 0,
          presetId: "warm-keys",
          name: "Keys",
          clips: [
            {
              clipId: "clip-1",
              startTick: 0,
              durationTicks: 1920,
              patternName: "Lead motif",
            },
            {
              clipId: "clip-2",
              startTick: 3840,
              durationTicks: 1920,
              patternName: "Answer phrase",
            },
          ],
        },
      ],
    },
    recentClips: [
      {
        patternId: "pattern",
        patternName: "Lead motif",
        patternVersionId: "pattern-version",
        versionNumber: 3,
        projectId: "clip-project",
        projectTitle: "Clip project",
        workspaceId: "clip-workspace",
        clipId: "clip-9",
        durationTicks: 1920,
        noteCount: 32,
        updatedAt: "2026-07-19T12:00:00.000Z",
      },
    ],
    counts: {
      projects: { count: 1, hasMore: false },
      clips: { count: 24, hasMore: false },
      savedClips: { count: 12, hasMore: false },
      pendingContributions: { count: 1, hasMore: false },
      archivingSoon: { count: 0, hasMore: false },
    },
  };

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
        submissionsCloseAt: "2099-01-01T00:00:00.000Z",
        constraints: {},
      },
    } as never);
    vi.mocked(getViewerDashboard).mockResolvedValue(populated);
  });

  it("drops the page heading so the space belongs to the work", async () => {
    render(await DashboardPage());
    expect(
      screen.queryByRole("heading", { name: "Dashboard" }),
    ).not.toBeInTheDocument();
  });

  it("offers the resumed workspace and deep-links each clip into the editor", async () => {
    render(await DashboardPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Workspace project" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Resume in studio" }),
    ).toHaveAttribute("href", "/studio/workspace-project");

    // Blocks are labelled with the pattern they place, on a named lane — not
    // anonymous bars — and each is a door into that exact clip.
    expect(
      screen.getByRole("link", { name: "Edit Lead motif on Keys" }),
    ).toHaveAttribute("href", "/studio/workspace-project?editClip=clip-1");
    expect(
      screen.getByRole("link", { name: "Edit Answer phrase on Keys" }),
    ).toHaveAttribute("href", "/studio/workspace-project?editClip=clip-2");
  });

  it("gives each row one action and the row itself a destination", async () => {
    render(await DashboardPage());

    expect(screen.getByRole("link", { name: "Owned project" })).toHaveAttribute(
      "href",
      "/projects/owned-project",
    );
    expect(
      screen.getByRole("link", { name: "Open in studio" }),
    ).toHaveAttribute("href", "/studio/owned-project");
    expect(
      screen.getByRole("link", { name: "Open in editor" }),
    ).toHaveAttribute("href", "/studio/clip-project?editClip=clip-9");
  });

  it("does not re-list workspaces the projects section already covers", async () => {
    render(await DashboardPage());

    // "Workspace project" is the resume band's heading, not a row of its own,
    // and there is no separate workspaces list duplicating the projects above.
    expect(
      screen.queryByRole("link", { name: "Workspace project" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Workspace contribution" }),
    ).not.toBeInTheDocument();
  });

  it("caps each launcher list so it stays scannable", async () => {
    vi.mocked(getViewerDashboard).mockResolvedValue({
      ...populated,
      ownedProjects: Array.from({ length: 6 }, (_, index) => ({
        ...populated.ownedProjects[0]!,
        projectId: `project-${index}`,
        title: `Project ${index}`,
      })),
    });
    render(await DashboardPage());

    expect(
      screen.getAllByRole("link", { name: "Open in studio" }),
    ).toHaveLength(5);
    expect(
      screen.queryByRole("link", { name: "Project 5" }),
    ).not.toBeInTheDocument();
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
      /Explore open projects/,
      /Browse challenges/,
      /New clip/,
    ])
      expect(screen.getByRole("link", { name })).toHaveAttribute(
        "data-prefetch",
        "false",
      );
  });
});
