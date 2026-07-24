import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  sha256ManifestV3,
  type WorkspaceManifestV3,
} from "@/features/studio/manifest/v3";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ rpc: mocks.rpc }),
}));

import {
  getStudioClipDetail,
  importStudioClip,
  listStudioClipCollection,
  StudioClipRepositoryError,
} from "./studio-clip-collection";

const id = (suffix: string) => `00000000-0000-4000-8000-${suffix}`;
const ids = {
  project: id("000000000001"),
  workspace: id("000000000002"),
  pattern: id("000000000003"),
  version: id("000000000004"),
  creator: id("000000000005"),
  track: id("000000000006"),
  clip: id("000000000007"),
  request: id("000000000008"),
};
const note = {
  noteId: id("000000000009"),
  startTick: 0,
  durationTicks: 480,
  pitch: 60,
  velocity: 100,
};
const metadata = {
  patternId: ids.pattern,
  patternVersionId: ids.version,
  patternName: "Private phrase",
  versionNumber: 1,
  creatorId: ids.creator,
  creatorCreditName: "Producer",
  durationTicks: 960,
  noteCount: 1,
  createdAt: "2026-07-24T12:00:00.000Z",
  hasLineage: false,
  source: "owned",
  isOwned: true,
  isSaved: false,
  availability: "available",
  canImport: true,
  preset: { id: "warm-keys", version: 1, name: "Warm keys" },
};
const importedPattern = {
  midiPatternVersionId: ids.version,
  midiPatternId: ids.pattern,
  version: 1,
  creatorId: ids.creator,
  creatorCreditName: "Producer",
  parentMidiPatternVersionId: null,
  sourceMidiPatternVersionId: null,
  contentSha256: "a".repeat(64),
  noteCount: 1,
  ppq: 480,
  durationTicks: 960,
  reuseLicense: null,
  createdAt: "2026-07-24T12:00:00.000Z",
  notes: [note],
  name: "Private phrase",
  presetId: "warm-keys",
  presetVersion: 1,
};
const manifest: WorkspaceManifestV3 = {
  manifestVersion: 3,
  engine: "openmidi-midi",
  engineVersion: "openmidi-midi-3_tone-15.1.22_presets-1",
  projectId: ids.project,
  workspaceId: ids.workspace,
  tempoBpm: 120,
  timeSignature: { numerator: 4, denominator: 4 },
  musicalKey: "c-major",
  ppq: 480,
  durationTicks: 1920,
  tracks: [
    {
      trackId: ids.track,
      sortOrder: 0,
      name: "Private phrase",
      presetId: "warm-keys",
      presetVersion: 1,
      gainDb: -6,
      pan: 0,
      muted: false,
      soloed: false,
      clips: [
        {
          clipId: ids.clip,
          midiPatternVersionId: ids.version,
          startTick: 0,
          durationTicks: 960,
          sourceStartTick: 0,
          loop: false,
        },
      ],
    },
  ],
};

describe("Studio clip collection repository", () => {
  beforeEach(() => mocks.rpc.mockReset());

  it("validates the bounded metadata collection", async () => {
    mocks.rpc.mockResolvedValue({ data: { items: [metadata] }, error: null });
    await expect(
      listStudioClipCollection({ source: "all", query: null, limit: 100 }),
    ).resolves.toEqual({ items: [metadata] });
    expect(mocks.rpc).toHaveBeenCalledWith("list_studio_clip_collection", {
      p_source: "all",
      p_query: undefined,
      p_limit: 100,
    });
  });

  it("validates exact on-demand pattern detail", async () => {
    mocks.rpc.mockResolvedValue({
      data: { metadata, externalCredits: [], pattern: importedPattern },
      error: null,
    });
    await expect(getStudioClipDetail(ids.version)).resolves.toMatchObject({
      pattern: { midiPatternVersionId: ids.version, notes: [note] },
    });
  });

  it("validates the canonical import response and checksum", async () => {
    const response = {
      source: {
        kind: "owned",
        savedListingId: null,
        externalCredits: [],
      },
      projectId: ids.project,
      workspaceId: ids.workspace,
      contributionId: null,
      lockVersion: 2,
      manifestSha256: await sha256ManifestV3(manifest),
      manifest,
      trackId: ids.track,
      clipId: ids.clip,
      importedPattern,
    };
    mocks.rpc.mockResolvedValue({ data: response, error: null });

    await expect(
      importStudioClip({
        patternVersionId: ids.version,
        source: "owned",
        workspaceId: ids.workspace,
        requestId: ids.request,
        expectedWorkspaceLockVersion: 1,
        startTick: 0,
      }),
    ).resolves.toEqual(response);
  });

  it("rejects malformed or checksum-inconsistent database payloads", async () => {
    mocks.rpc.mockResolvedValue({
      data: { items: [{ ...metadata, noteCount: 2_049 }] },
      error: null,
    });
    await expect(
      listStudioClipCollection({ source: "all", query: null, limit: 100 }),
    ).rejects.toThrow();

    mocks.rpc.mockResolvedValue({
      data: {
        source: {
          kind: "owned",
          savedListingId: null,
          externalCredits: [],
        },
        projectId: ids.project,
        workspaceId: ids.workspace,
        contributionId: null,
        lockVersion: 2,
        manifestSha256: "f".repeat(64),
        manifest,
        trackId: ids.track,
        clipId: ids.clip,
        importedPattern,
      },
      error: null,
    });
    await expect(
      importStudioClip({
        patternVersionId: ids.version,
        source: "owned",
        workspaceId: ids.workspace,
        requestId: ids.request,
        expectedWorkspaceLockVersion: 1,
        startTick: 0,
      }),
    ).rejects.toMatchObject({ reason: "unavailable" });
  });

  it("maps specific database conflicts for the later Studio UI", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "studio_clip_workspace_stale" },
    });
    await expect(
      importStudioClip({
        patternVersionId: ids.version,
        source: "owned",
        workspaceId: ids.workspace,
        requestId: ids.request,
        expectedWorkspaceLockVersion: 1,
        startTick: 0,
      }),
    ).rejects.toEqual(new StudioClipRepositoryError("workspace_stale"));
  });
});
