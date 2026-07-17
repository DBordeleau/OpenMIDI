import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import {
  publishMidiWorkspaceV3Action,
  saveMidiWorkspaceV3Action,
} from "./actions";
import {
  publishMidiWorkspaceRevisionV3,
  saveMidiWorkspaceV3,
} from "@/server/repositories/midi-v3";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/repositories/workspaces", () => ({
  createProjectWorkspace: vi.fn(),
  publishWorkspaceRevision: vi.fn(),
  publishMidiWorkspaceRevision: vi.fn(),
  reserveWorkspaceSnapshot: vi.fn(),
  restartProjectWorkspace: vi.fn(),
  saveWorkspace: vi.fn(),
  saveMidiWorkspace: vi.fn(),
}));
vi.mock("@/server/repositories/midi-v3", () => ({
  publishMidiWorkspaceRevisionV3: vi.fn(),
  saveMidiWorkspaceV3: vi.fn(),
}));

const projectId = "00000000-0000-4000-8000-000000000001";
const workspaceId = "00000000-0000-4000-8000-000000000002";
const manifest = {
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
} as const;

describe("manifest-v3 workspace actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves the canonical v3 JSONB snapshot through the bounded Postgres command", async () => {
    vi.mocked(saveMidiWorkspaceV3).mockResolvedValue({
      lock_version: 2,
      manifest_sha256: "a".repeat(64),
      updated_at: "2026-07-16T12:00:00.000Z",
    } as never);

    await expect(
      saveMidiWorkspaceV3Action({
        workspaceId,
        requestId: "00000000-0000-4000-8000-000000000003",
        expectedLockVersion: 1,
        manifest,
      }),
    ).resolves.toEqual({
      ok: true,
      lockVersion: 2,
      manifestSha256: "a".repeat(64),
      updatedAt: "2026-07-16T12:00:00.000Z",
    });
    expect(saveMidiWorkspaceV3).toHaveBeenCalledWith(
      expect.objectContaining({ manifest }),
    );
  });

  it("publishes through the atomic arrangement-freeze command", async () => {
    vi.mocked(publishMidiWorkspaceRevisionV3).mockResolvedValue({
      revision_id: "00000000-0000-4000-8000-000000000004",
      revision_number: 1,
      arrangement_version_id: "00000000-0000-4000-8000-000000000005",
    } as never);

    const result = await publishMidiWorkspaceV3Action(projectId, {
      workspaceId,
      requestId: "00000000-0000-4000-8000-000000000006",
      expectedLockVersion: 2,
      expectedBaseRevisionId: null,
      message: "First take",
    });

    expect(result).toEqual({
      ok: true,
      revisionId: "00000000-0000-4000-8000-000000000004",
      revisionNumber: 1,
      arrangementVersionId: "00000000-0000-4000-8000-000000000005",
    });
    expect(publishMidiWorkspaceRevisionV3).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedWorkspaceLockVersion: 2,
        expectedBaseRevisionId: null,
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith(`/studio/${projectId}`);
  });
});
