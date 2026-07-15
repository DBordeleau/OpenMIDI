import { beforeEach, describe, expect, it, vi } from "vitest";
import StudioProjectPage from "./page";
import { requireViewer } from "@/features/auth/guards";
import { notFound } from "next/navigation";
import { resolveStudioSession } from "@/server/services/studio-session";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/features/auth/guards", () => ({ requireViewer: vi.fn() }));
vi.mock("@/server/services/studio-session", () => ({
  resolveStudioSession: vi.fn(),
}));
vi.mock("@/server/repositories/contributions", () => ({
  getContributionForViewer: vi.fn(),
}));
vi.mock("@/server/repositories/midi-stems", () => ({
  listMidiStemVersionsForStudio: vi.fn(),
}));
vi.mock("@/server/repositories/revisions", () => ({
  listWorkspaceAssetOptions: vi.fn(),
}));
vi.mock("@/features/studio/components/studio-launcher.client", () => ({
  StudioLauncher: () => null,
}));
vi.mock("@/features/workspaces/create-workspace-form", () => ({
  CreateWorkspaceForm: () => null,
}));

const projectId = "10000000-0000-4000-8000-000000000123";

describe("canonical selected Studio route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects malformed identifiers before authorization or data access", async () => {
    await expect(
      StudioProjectPage({
        params: Promise.resolve({ projectId: "not-an-id" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(requireViewer).not.toHaveBeenCalled();
    expect(resolveStudioSession).not.toHaveBeenCalled();
  });

  it("uses the canonical callback and hides a missing or unauthorized session", async () => {
    vi.mocked(requireViewer).mockResolvedValue({ id: projectId } as never);
    vi.mocked(resolveStudioSession).mockResolvedValue(null);

    await expect(
      StudioProjectPage({ params: Promise.resolve({ projectId }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(requireViewer).toHaveBeenCalledWith(`/studio/${projectId}`);
    expect(resolveStudioSession).toHaveBeenCalledWith(projectId, projectId);
    expect(notFound).toHaveBeenCalledOnce();
  });
});
