import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: mocks.maybeSingle,
      };
      return query;
    },
    rpc: mocks.rpc,
  }),
}));

import {
  createContributionWorkspace,
  reviewContribution,
  submitContribution,
} from "./contributions";
import { forkProject } from "./forks";

const id = "10000000-0000-4000-8000-000000000001";

describe("MIDI v3 collaboration repository commands", () => {
  beforeEach(() => {
    mocks.maybeSingle.mockReset();
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ data: [], error: null });
  });

  it("creates and freezes contributions through the v3 RPCs", async () => {
    mocks.maybeSingle
      .mockResolvedValueOnce({
        data: null,
        error: null,
      })
      .mockResolvedValueOnce({
        data: { license_code: "cc-by-4.0" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          base_revision_id: id,
        },
        error: null,
      });
    mocks.rpc.mockImplementation(async (name: string) =>
      name === "get_contribution_project_context"
        ? {
            data: {
              title: "Project",
              ownerId: id,
              currentRevisionId: id,
              currentRevisionNumber: 1,
              baseRevisionNumber: 1,
              license: {
                code: "cc-by-4.0",
                name: "CC BY 4.0",
                url: "https://creativecommons.org/licenses/by/4.0/",
                summary: "Attribution required.",
              },
            },
            error: null,
          }
        : { data: [], error: null },
    );

    await createContributionWorkspace({
      projectId: id,
      requestId: id,
      expectedCurrentRevisionId: id,
      expectedLicenseCode: "cc-by-4.0",
      title: "Proposal",
      description: null,
    });
    await submitContribution({
      contributionId: id,
      requestId: id,
      expectedWorkspaceLockVersion: 2,
      expectedBaseRevisionId: id,
      expectedManifestSha256: "a".repeat(64),
      expectedLicenseCode: "cc-by-4.0",
      attestationVersion: "contributor-attestation-v1",
    });

    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual([
      "create_contribution_workspace_v3",
      "get_contribution_project_context",
      "submit_contribution_v3",
    ]);
  });

  it("routes only acceptance through the atomic v3 acceptance command", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [
        {
          revision_id: id,
          revision_number: 2,
          arrangement_version_id: id,
          created_at: "2026-07-16T00:00:00Z",
        },
      ],
      error: null,
    });
    const common = {
      contributionId: id,
      requestId: id,
      expectedStatus: "submitted" as const,
      expectedCurrentVersionId: id,
      expectedProjectRevisionId: id,
      note: null,
    };
    const accepted = await reviewContribution({
      ...common,
      decision: "accept",
    });
    await reviewContribution({ ...common, decision: "request_changes" });

    expect(accepted.data?.[0]).toMatchObject({
      status: "accepted",
      revision_id: id,
    });
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual([
      "accept_contribution_v3",
      "review_contribution",
    ]);
  });

  it("forks exact revisions through the copy-on-write v3 command", async () => {
    await forkProject({
      sourceProjectId: id,
      sourceRevisionId: id,
      requestId: id,
      expectedLicenseCode: "cc-by-4.0",
      rightsAttestationVersion: "cc-by-4.0-reuse-attestation-v1",
      attested: true,
      title: "Fork",
      description: null,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("fork_project_v3", {
      p_source_project_id: id,
      p_source_revision_id: id,
      p_request_id: id,
      p_expected_license_code: "cc-by-4.0",
      p_rights_attestation_version: "cc-by-4.0-reuse-attestation-v1",
      p_title: "Fork",
      p_description: "",
    });
  });
});
