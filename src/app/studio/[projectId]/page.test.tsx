import { beforeEach, describe, expect, it, vi } from "vitest";
import StudioProjectPage from "./page";
import { requireViewer } from "@/features/auth/guards";
import { notFound } from "next/navigation";
import { resolveStudioSession } from "@/server/services/studio-session";
import { loadStudioPatternVersions } from "@/server/repositories/studio-v3";
import type { ReactElement } from "react";

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
vi.mock("@/server/repositories/studio-v3", () => ({
  loadStudioPatternVersions: vi.fn(),
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

  it("loads an editable workspace and exact pattern versions through manifest v3", async () => {
    vi.mocked(requireViewer).mockResolvedValue({ id: projectId } as never);
    const manifest = {
      manifestVersion: 3,
      engine: "jam-session-midi",
      engineVersion: "jam-session-midi-3_tone-15.1.22_presets-1",
      projectId,
      workspaceId: "10000000-0000-4000-8000-000000000124",
      tempoBpm: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      musicalKey: null,
      ppq: 480,
      durationTicks: 3840,
      tracks: [],
    } as const;
    vi.mocked(resolveStudioSession).mockResolvedValue({
      project: {
        id: projectId,
        ownerId: projectId,
        title: "V3 session",
        timeSignature: { numerator: 4, denominator: 4 },
      },
      workspace: {
        id: manifest.workspaceId,
        contributionId: null,
        baseRevisionId: null,
        lockVersion: 1,
        manifest,
        manifestSha256: "a".repeat(64),
        updatedAt: "2026-07-16T12:00:00.000Z",
      },
      revision: null,
      descriptor: null,
    } as never);
    vi.mocked(loadStudioPatternVersions).mockResolvedValue([]);

    const page = (await StudioProjectPage({
      params: Promise.resolve({ projectId }),
    })) as ReactElement<{ children: ReactElement }>;
    const launcher = page.props.children as ReactElement<{
      manifest: unknown;
      patternVersions: unknown;
    }>;

    expect(launcher.props.manifest).toEqual(manifest);
    expect(launcher.props.patternVersions).toEqual([]);
  });
});
