import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceManifestV3 } from "@/features/studio/manifest/v3";
import { getProjectForViewer } from "@/server/repositories/projects";
import { getPublicProject } from "@/server/repositories/public-projects";
import {
  getStudioRevisionV3,
  getStudioWorkspaceV3,
} from "@/server/repositories/studio-v3";
import { resolveStudioSession } from "./studio-session";

vi.mock("@/server/repositories/projects", () => ({
  getProjectForViewer: vi.fn(),
}));
vi.mock("@/server/repositories/public-projects", () => ({
  getPublicProject: vi.fn(),
}));
vi.mock("@/server/repositories/studio-v3", () => ({
  getStudioRevisionV3: vi.fn(),
  getStudioWorkspaceV3: vi.fn(),
}));

const projectId = "10000000-0000-4000-8000-000000000123";
const viewerId = "20000000-0000-4000-8000-000000000123";
const revisionId = "30000000-0000-4000-8000-000000000123";
const workspaceId = "40000000-0000-4000-8000-000000000123";
const contributionId = "50000000-0000-4000-8000-000000000123";
const manifest: WorkspaceManifestV3 = {
  manifestVersion: 3,
  engine: "jam-session-midi",
  engineVersion: "jam-session-midi-3_tone-15.1.22_presets-1",
  projectId,
  workspaceId,
  tempoBpm: 120,
  timeSignature: { numerator: 4, denominator: 4 },
  musicalKey: null,
  ppq: 480,
  durationTicks: 3840,
  tracks: [],
};

describe("resolveStudioSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads an owned contribution workspace through public project context", async () => {
    vi.mocked(getProjectForViewer).mockResolvedValue(null);
    vi.mocked(getStudioWorkspaceV3).mockResolvedValue({
      id: workspaceId,
      projectId,
      ownerId: viewerId,
      contributionId,
      baseRevisionId: revisionId,
      lockVersion: 1,
      manifest,
      manifestSha256: "a".repeat(64),
      updatedAt: "2026-07-17T00:00:00.000Z",
    });
    vi.mocked(getPublicProject).mockResolvedValue({
      projectId,
      ownerId: "60000000-0000-4000-8000-000000000123",
      title: "Public project",
      timeSignature: { numerator: 4, denominator: 4 },
      license: {
        code: "cc-by-4.0",
        name: "CC BY 4.0",
        url: "https://creativecommons.org/licenses/by/4.0/",
        summary: "Reuse with attribution.",
        allowsDerivatives: true,
      },
      openToContributions: true,
      currentRevisionId: revisionId,
    } as never);
    vi.mocked(getStudioRevisionV3).mockResolvedValue({
      projectId,
      revisionId,
      revisionNumber: 1,
      arrangementVersionId: "70000000-0000-4000-8000-000000000123",
      manifest: { ...manifest, workspaceId: undefined } as never,
      manifestSha256: "b".repeat(64),
      durationMs: 4000,
    });

    const session = await resolveStudioSession(projectId, viewerId);

    expect(session?.descriptor?.mode).toBe("contributionWorkspace");
    expect(session?.descriptor?.capabilities.canEdit).toBe(true);
    expect(session?.descriptor?.capabilities.canSubmit).toBe(true);
    expect(getPublicProject).toHaveBeenCalledWith(projectId);
  });

  it("does not expose Studio to an unrelated public viewer", async () => {
    vi.mocked(getProjectForViewer).mockResolvedValue(null);
    vi.mocked(getStudioWorkspaceV3).mockResolvedValue(null);

    await expect(resolveStudioSession(projectId, viewerId)).resolves.toBeNull();
    expect(getPublicProject).not.toHaveBeenCalled();
    expect(getStudioRevisionV3).not.toHaveBeenCalled();
  });
});
