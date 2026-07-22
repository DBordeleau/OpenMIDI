import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  cacheCalls: [] as Array<{
    key: string[];
    options: { tags: string[]; revalidate: false };
  }>,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: (
    loader: () => unknown,
    key: string[],
    options: { tags: string[]; revalidate: false },
  ) => {
    mocks.cacheCalls.push({ key, options });
    return loader;
  },
}));
vi.mock("@/lib/supabase/anonymous", () => ({
  createSupabaseAnonymousClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { getPublicProjectSilhouettes } from "./public-midi";

const projectId = "40200000-0000-4000-8000-000000000001";
const revisionId = "40200000-0000-4000-8000-000000000002";
const patternVersionId = "40200000-0000-4000-8000-000000000003";
const silhouette = `${"A".repeat(86)}==`;

describe("public project silhouettes", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.cacheCalls.length = 0;
  });

  it("maps canonical RPC rows and permanently caches immutable revisions", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          midi_pattern_version_id: patternVersionId,
          silhouette,
          min_pitch: 24,
          max_pitch: 96,
        },
      ],
      error: null,
    });

    const result = await getPublicProjectSilhouettes(projectId, revisionId);

    expect(result).toEqual(
      new Map([[patternVersionId, { silhouette, minPitch: 24, maxPitch: 96 }]]),
    );
    expect(mocks.rpc).toHaveBeenCalledWith("get_public_project_silhouettes", {
      p_project_id: projectId,
      p_revision_id: revisionId,
    });
    expect(mocks.cacheCalls).toEqual([
      {
        key: ["public-project-silhouettes-v1", projectId, revisionId],
        options: {
          tags: ["public-projects", `public-project:${projectId}`],
          revalidate: false,
        },
      },
    ]);
  });

  it("preserves the all-null flat-clip degradation shape", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          midi_pattern_version_id: patternVersionId,
          silhouette: null,
          min_pitch: null,
          max_pitch: null,
        },
      ],
      error: null,
    });

    await expect(
      getPublicProjectSilhouettes(projectId, revisionId),
    ).resolves.toEqual(
      new Map([
        [
          patternVersionId,
          { silhouette: null, minPitch: null, maxPitch: null },
        ],
      ]),
    );
  });

  it("returns an empty map for revisions with no clips", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await expect(
      getPublicProjectSilhouettes(projectId, revisionId),
    ).resolves.toEqual(new Map());
  });

  it.each([
    {
      midi_pattern_version_id: patternVersionId,
      silhouette: "not-base64",
      min_pitch: 24,
      max_pitch: 96,
    },
    {
      midi_pattern_version_id: patternVersionId,
      silhouette,
      min_pitch: null,
      max_pitch: 96,
    },
    {
      midi_pattern_version_id: patternVersionId,
      silhouette,
      min_pitch: 97,
      max_pitch: 96,
    },
  ])("rejects malformed RPC rows at the repository boundary", async (row) => {
    mocks.rpc.mockResolvedValue({ data: [row], error: null });

    await expect(
      getPublicProjectSilhouettes(projectId, revisionId),
    ).rejects.toThrow();
  });

  it("rejects duplicate version rows instead of silently overwriting", async () => {
    const row = {
      midi_pattern_version_id: patternVersionId,
      silhouette,
      min_pitch: 24,
      max_pitch: 96,
    };
    mocks.rpc.mockResolvedValue({ data: [row, row], error: null });

    await expect(
      getPublicProjectSilhouettes(projectId, revisionId),
    ).rejects.toThrow("public_project_silhouettes_invalid");
  });
});
