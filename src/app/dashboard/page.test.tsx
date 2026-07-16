import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireViewer } from "@/features/auth/guards";
import { getViewerDashboard } from "@/server/repositories/dashboard";
import { assertViewerAdmin } from "@/server/repositories/moderation";
import DashboardPage from "./page";

vi.mock("@/features/auth/guards", () => ({ requireViewer: vi.fn() }));
vi.mock("@/server/repositories/dashboard", () => ({
  getViewerDashboard: vi.fn(),
}));
vi.mock("@/server/repositories/moderation", () => ({
  assertViewerAdmin: vi.fn(),
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
