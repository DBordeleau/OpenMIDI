import { beforeEach, describe, expect, it, vi } from "vitest";
import { V3_MANIFEST_BEFORE } from "@/features/studio/manifest/v3.fixtures";

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  getDiscoveryVersion: vi.fn(),
  getPublicProjectProfiles: vi.fn(),
  getPublicArrangementCards: vi.fn(),
  getPublicProjectSilhouettes: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: (loader: (...args: unknown[]) => unknown) => loader,
}));
vi.mock("@/lib/supabase/anonymous", () => ({
  createSupabaseAnonymousClient: () => {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: mocks.maybeSingle,
    };
    return { from: () => query };
  },
}));
vi.mock("@/server/repositories/discovery", () => ({
  getDiscoveryVersion: mocks.getDiscoveryVersion,
}));
vi.mock("@/server/repositories/public-project-profiles", () => ({
  getPublicProjectProfiles: mocks.getPublicProjectProfiles,
}));
vi.mock("@/server/repositories/public-midi", () => ({
  getPublicArrangementCards: mocks.getPublicArrangementCards,
  getPublicProjectSilhouettes: mocks.getPublicProjectSilhouettes,
}));

import { getPublicProject } from "./public-projects";

const projectId = V3_MANIFEST_BEFORE.projectId;
const revisionId = "40300000-0000-4000-8000-000000000001";
const ownerId = "40300000-0000-4000-8000-000000000002";
const patternVersionId = "40300000-0000-4000-8000-000000000003";

describe("public project detail data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDiscoveryVersion.mockResolvedValue(7);
    mocks.maybeSingle.mockResolvedValue({
      data: {
        project_id: projectId,
        owner_id: ownerId,
        title: "Public map project",
        description: null,
        bpm: 120,
        musical_key: "c-major",
        time_signature_numerator: 4,
        time_signature_denominator: 4,
        license_code: "cc-by-4.0",
        license_name: "CC BY 4.0",
        license_url: "https://creativecommons.org/licenses/by/4.0/",
        license_summary: "Reuse with attribution.",
        license_allows_derivatives: true,
        open_to_contributions: true,
        current_revision_id: revisionId,
        revision_number: 1,
        duration_ms: 4_000,
        published_at: "2026-07-22T00:00:00.000Z",
        updated_at: "2026-07-22T00:00:00.000Z",
        genres: [],
        tags: [],
        tracks: [],
        attributions: [],
        trending_score: 1,
        discovery_version: 7,
      },
      error: null,
    });
    mocks.getPublicProjectProfiles.mockResolvedValue(
      new Map([
        [
          ownerId,
          {
            username: "MapMaker",
            displayName: "Map Maker",
            avatarConfig: { version: 1 },
          },
        ],
      ]),
    );
    mocks.getPublicArrangementCards.mockResolvedValue(
      new Map([
        [
          revisionId,
          { manifest: V3_MANIFEST_BEFORE, durationMs: 4_000, tracks: [] },
        ],
      ]),
    );
    mocks.getPublicProjectSilhouettes.mockResolvedValue(
      new Map([
        [
          patternVersionId,
          { silhouette: null, minPitch: null, maxPitch: null },
        ],
      ]),
    );
  });

  it("loads arrangement cards and silhouettes together for project detail", async () => {
    const project = await getPublicProject(projectId);

    expect(mocks.getPublicArrangementCards).toHaveBeenCalledWith([
      { projectId, revisionId },
    ]);
    expect(mocks.getPublicProjectSilhouettes).toHaveBeenCalledWith(
      projectId,
      revisionId,
    );
    expect(project?.patternSilhouettes).toEqual(
      new Map([
        [
          patternVersionId,
          { silhouette: null, minPitch: null, maxPitch: null },
        ],
      ]),
    );
    expect(project?.ownerAvatarConfig).toEqual({ version: 1 });
  });
});
