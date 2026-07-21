import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ rpc: mocks.rpc }),
}));

import { getViewerDashboard } from "./dashboard";

const ids = {
  project: "10000000-0000-4000-8000-000000000001",
  revision: "10000000-0000-4000-8000-000000000002",
  workspace: "10000000-0000-4000-8000-000000000003",
  track: "10000000-0000-4000-8000-000000000004",
  clip: "10000000-0000-4000-8000-000000000005",
  pattern: "10000000-0000-4000-8000-000000000006",
  patternVersion: "10000000-0000-4000-8000-000000000007",
};

const count = { count: 1, hasMore: false };

describe("dashboard repository", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-21T12:00:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("validates and maps the extended launcher payload", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        ownedProjects: [
          {
            project_id: ids.project,
            title: "Night loop",
            status: "active",
            current_revision_id: ids.revision,
            revision_number: 4,
            track_count: 3,
            review_count: 2,
            updated_at: "2026-07-20T12:00:00.000Z",
          },
        ],
        activeWorkspaces: [
          {
            workspace_id: ids.workspace,
            project_id: ids.project,
            project_title: "Night loop",
            contribution_id: null,
            contribution_title: null,
            lock_version: 7,
            updated_at: "2026-06-28T12:00:00.000Z",
          },
        ],
        pendingContributions: [],
        review: { count: 2, hasMore: false },
        resume: {
          workspace_id: ids.workspace,
          project_id: ids.project,
          project_title: "Night loop",
          contribution_id: null,
          contribution_title: null,
          updated_at: "2026-06-28T12:00:00.000Z",
          lock_version: 7,
          tempo_bpm: 118,
          duration_ticks: 7680,
          musical_key: "d-minor",
          time_signature_numerator: 4,
          time_signature_denominator: 4,
          tracks: [
            {
              track_id: ids.track,
              sort_order: 0,
              preset_id: "warm-keys",
              name: "Keys",
              clips: [
                {
                  clip_id: ids.clip,
                  start_tick: 0,
                  duration_ticks: 1920,
                  pattern_name: "Lead motif",
                },
              ],
            },
          ],
        },
        recentClips: [
          {
            pattern_id: ids.pattern,
            pattern_name: "Warm chord",
            pattern_version_id: ids.patternVersion,
            version_number: 3,
            project_id: ids.project,
            project_title: "Night loop",
            workspace_id: ids.workspace,
            clip_id: ids.clip,
            duration_ticks: 1920,
            note_count: 8,
            updated_at: "2026-07-20T12:00:00.000Z",
          },
        ],
        counts: {
          projects: count,
          clips: count,
          savedClips: { count: 0, hasMore: false },
          pendingContributions: { count: 0, hasMore: false },
          archivingSoon: count,
        },
      },
      error: null,
    });

    await expect(getViewerDashboard()).resolves.toMatchObject({
      ownedProjects: [
        {
          projectId: ids.project,
          revisionNumber: 4,
          trackCount: 3,
          reviewCount: 2,
        },
      ],
      activeWorkspaces: [
        {
          archivesAt: "2026-07-28T12:00:00.000Z",
          archiveWarning: true,
        },
      ],
      resume: {
        workspaceId: ids.workspace,
        tempoBpm: 118,
        tracks: [
          {
            trackId: ids.track,
            clips: [{ clipId: ids.clip }],
          },
        ],
      },
      recentClips: [
        {
          patternId: ids.pattern,
          patternVersionId: ids.patternVersion,
          clipId: ids.clip,
        },
      ],
      counts: { projects: count, archivingSoon: count },
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_viewer_dashboard");
  });

  it("rejects malformed extended payloads", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        ownedProjects: [],
        activeWorkspaces: [],
        pendingContributions: [],
        review: { count: 0, hasMore: false },
        resume: null,
        recentClips: [],
        counts: { projects: { count: 100, hasMore: true } },
      },
      error: null,
    });

    await expect(getViewerDashboard()).rejects.toThrow();
  });
});
