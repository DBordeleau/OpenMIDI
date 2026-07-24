import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/repositories/studio-clip-collection", () => ({
  StudioClipRepositoryError: class extends Error {
    constructor(readonly reason: string) {
      super(`studio_clip_${reason}`);
    }
  },
  getStudioClipDetail: vi.fn(),
  importStudioClip: vi.fn(),
  listStudioClipCollection: vi.fn(),
}));

import {
  getStudioClipDetailAction,
  importStudioClipAction,
  listStudioClipCollectionAction,
} from "./actions";
import {
  getStudioClipDetail,
  importStudioClip,
  listStudioClipCollection,
  StudioClipRepositoryError,
} from "@/server/repositories/studio-clip-collection";

const id = (suffix: string) => `00000000-0000-4000-8000-${suffix}`;

describe("Studio clip collection actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects malformed collection and import requests before repository calls", async () => {
    await expect(
      listStudioClipCollectionAction({
        source: "everything",
        query: null,
        limit: 100,
      }),
    ).resolves.toEqual({ ok: false, code: "invalid_request" });
    await expect(
      importStudioClipAction({
        patternVersionId: id("000000000001"),
        source: "owned",
        workspaceId: id("000000000002"),
        requestId: id("000000000003"),
        expectedWorkspaceLockVersion: 0,
        startTick: 0,
      }),
    ).resolves.toEqual({ ok: false, code: "invalid_request" });
    expect(listStudioClipCollection).not.toHaveBeenCalled();
    expect(importStudioClip).not.toHaveBeenCalled();
  });

  it("passes bounded inputs to the collection and detail repositories", async () => {
    vi.mocked(listStudioClipCollection).mockResolvedValue({
      items: [],
    });
    vi.mocked(getStudioClipDetail).mockResolvedValue({} as never);

    await expect(
      listStudioClipCollectionAction({
        source: "saved",
        query: "bass",
        limit: 25,
      }),
    ).resolves.toEqual({ ok: true, collection: { items: [] } });
    await expect(
      getStudioClipDetailAction({
        patternVersionId: id("000000000001"),
      }),
    ).resolves.toEqual({ ok: true, detail: {} });
  });

  it.each([
    "workspace_unavailable",
    "workspace_stale",
    "saved_source_unavailable",
    "invalid_start_tick",
    "request_mismatch",
    "track_limit",
  ] as const)("preserves the stable %s failure code", async (reason) => {
    vi.mocked(importStudioClip).mockRejectedValue(
      new StudioClipRepositoryError(reason),
    );
    await expect(
      importStudioClipAction({
        patternVersionId: id("000000000001"),
        source: "saved",
        workspaceId: id("000000000002"),
        requestId: id("000000000003"),
        expectedWorkspaceLockVersion: 1,
        startTick: 0,
      }),
    ).resolves.toEqual({ ok: false, code: reason });
  });
});
