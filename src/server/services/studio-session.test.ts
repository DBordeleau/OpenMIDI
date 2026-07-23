import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceManifestV3 } from "@/features/studio/manifest/v3";
import { getProjectForViewer } from "@/server/repositories/projects";
import { getPublicProject } from "@/server/repositories/public-projects";
import {
  getStudioRevisionNumberV3,
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
  getStudioRevisionNumberV3: vi.fn(),
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
  engine: "openmidi-midi",
  engineVersion: "openmidi-midi-3_tone-15.1.22_presets-1",
  projectId,
  workspaceId,
  tempoBpm: 120,
  timeSignature: { numerator: 4, denominator: 4 },
  musicalKey: null,
  ppq: 480,
  durationTicks: 3840,
  tracks: [],
};

const project = {
  id: projectId,
  ownerId: viewerId,
  title: "Owned project",
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
  compatibility: "midi" as const,
};

const revision = {
  projectId,
  revisionId,
  revisionNumber: 2,
  arrangementVersionId: "70000000-0000-4000-8000-000000000123",
  manifest: { ...manifest, workspaceId: undefined } as never,
  manifestSha256: "b".repeat(64),
  durationMs: 4000,
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

  it("keeps an owner workspace as the default when its base is stale", async () => {
    const staleBaseRevisionId = "80000000-0000-4000-8000-000000000123";
    vi.mocked(getProjectForViewer).mockResolvedValue(project as never);
    vi.mocked(getStudioWorkspaceV3).mockResolvedValue({
      id: workspaceId,
      projectId,
      ownerId: viewerId,
      contributionId: null,
      baseRevisionId: staleBaseRevisionId,
      lockVersion: 3,
      manifest,
      manifestSha256: "a".repeat(64),
      updatedAt: "2026-07-19T00:00:00.000Z",
    });
    vi.mocked(getStudioRevisionV3).mockResolvedValue(revision);
    vi.mocked(getStudioRevisionNumberV3).mockResolvedValue(1);

    const session = await resolveStudioSession(projectId, viewerId);

    expect(session?.descriptor?.mode).toBe("ownerWorkspace");
    expect(session?.descriptor?.capabilities.canEdit).toBe(true);
    expect(session?.descriptor?.capabilities.canPublish).toBe(false);
    if (session?.descriptor?.mode !== "ownerWorkspace")
      throw new Error("Expected owner workspace");
    expect(session.descriptor.authority.staleDraft).toEqual({
      baseRevisionId: staleBaseRevisionId,
      baseRevisionNumber: 1,
      currentRevisionId: revisionId,
      currentRevisionNumber: 2,
    });
  });

  it("keeps a current owner workspace publishable", async () => {
    vi.mocked(getProjectForViewer).mockResolvedValue(project as never);
    vi.mocked(getStudioWorkspaceV3).mockResolvedValue({
      id: workspaceId,
      projectId,
      ownerId: viewerId,
      contributionId: null,
      baseRevisionId: revisionId,
      lockVersion: 3,
      manifest,
      manifestSha256: "a".repeat(64),
      updatedAt: "2026-07-19T00:00:00.000Z",
    });
    vi.mocked(getStudioRevisionV3).mockResolvedValue(revision);

    const session = await resolveStudioSession(projectId, viewerId);

    expect(session?.descriptor?.capabilities.canPublish).toBe(true);
    if (session?.descriptor?.mode !== "ownerWorkspace")
      throw new Error("Expected owner workspace");
    expect(session.descriptor.authority.staleDraft).toBeNull();
    expect(getStudioRevisionNumberV3).not.toHaveBeenCalled();
  });

  it("opens the latest immutable revision without replacing an owner workspace", async () => {
    vi.mocked(getProjectForViewer).mockResolvedValue(project as never);
    vi.mocked(getStudioWorkspaceV3).mockResolvedValue({
      id: workspaceId,
      projectId,
      ownerId: viewerId,
      contributionId: null,
      baseRevisionId: "80000000-0000-4000-8000-000000000123",
      lockVersion: 3,
      manifest,
      manifestSha256: "a".repeat(64),
      updatedAt: "2026-07-19T00:00:00.000Z",
    });
    vi.mocked(getStudioRevisionV3).mockResolvedValue(revision);
    vi.mocked(getStudioRevisionNumberV3).mockResolvedValue(1);

    const session = await resolveStudioSession(projectId, viewerId, {
      revisionId,
    });

    expect(session?.descriptor?.mode).toBe("memberRevision");
    expect(session?.descriptor?.capabilities.canEdit).toBe(false);
    expect(session?.workspace?.id).toBe(workspaceId);
  });

  it("rejects a revision selector that does not target the current revision", async () => {
    vi.mocked(getProjectForViewer).mockResolvedValue(project as never);
    vi.mocked(getStudioWorkspaceV3).mockResolvedValue(null);

    await expect(
      resolveStudioSession(projectId, viewerId, {
        revisionId: "80000000-0000-4000-8000-000000000123",
      }),
    ).resolves.toBeNull();
    expect(getStudioRevisionV3).not.toHaveBeenCalled();
  });
});
