import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveStaleOwnerWorkspace,
  type StaleDraftResolutionFailure,
} from "./workspaces";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ rpc })),
}));

const input = {
  workspaceId: "10000000-0000-4000-8000-000000000001",
  requestId: "10000000-0000-4000-8000-000000000002",
  expectedWorkspaceLockVersion: 4,
  expectedBaseRevisionId: "10000000-0000-4000-8000-000000000003",
  expectedCurrentRevisionId: "10000000-0000-4000-8000-000000000004",
  resolution: "preserve_as_fork" as const,
  forkTitle: "Recovered draft",
};
const row = {
  resolution: "preserve_as_fork" as const,
  source_project_id: "10000000-0000-4000-8000-000000000005",
  source_workspace_id: input.workspaceId,
  target_project_id: "10000000-0000-4000-8000-000000000006",
  target_workspace_id: "10000000-0000-4000-8000-000000000007",
  target_base_revision_id: "10000000-0000-4000-8000-000000000008",
  target_workspace_lock_version: 1,
  created_at: "2026-07-23T12:00:00+00:00",
};

describe("stale owner workspace repository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls only the narrow resolution RPC and parses the complete result", async () => {
    rpc.mockResolvedValue({ data: [row], error: null });

    await expect(resolveStaleOwnerWorkspace(input)).resolves.toEqual(row);
    expect(rpc).toHaveBeenCalledWith("resolve_stale_owner_workspace_v3", {
      p_workspace_id: input.workspaceId,
      p_request_id: input.requestId,
      p_expected_workspace_lock_version: 4,
      p_expected_base_revision_id: input.expectedBaseRevisionId,
      p_expected_current_revision_id: input.expectedCurrentRevisionId,
      p_resolution: "preserve_as_fork",
      p_fork_title: "Recovered draft",
    });
  });

  it.each<{
    code: string;
    message: string;
    reason: StaleDraftResolutionFailure;
  }>([
    {
      code: "22023",
      message: "draft_resolution_invalid_input",
      reason: "invalid_request",
    },
    {
      code: "PT409",
      message: "draft_resolution_request_conflict",
      reason: "invalid_request",
    },
    {
      code: "PT409",
      message: "draft_resolution_workspace_changed",
      reason: "workspace_changed",
    },
    {
      code: "PT409",
      message: "draft_resolution_project_changed",
      reason: "project_changed",
    },
    {
      code: "PT409",
      message: "draft_resolution_not_stale",
      reason: "not_stale",
    },
    {
      code: "PT401",
      message: "draft_resolution_unauthenticated",
      reason: "forbidden",
    },
    {
      code: "PT403",
      message: "draft_resolution_actor_ineligible",
      reason: "forbidden",
    },
    {
      code: "PT404",
      message: "draft_resolution_workspace_not_found",
      reason: "forbidden",
    },
    {
      code: "XX000",
      message: "unexpected",
      reason: "unavailable",
    },
  ])("maps $message to $reason", async ({ code, message, reason }) => {
    rpc.mockResolvedValue({ data: null, error: { code, message } });

    await expect(resolveStaleOwnerWorkspace(input)).rejects.toMatchObject({
      reason,
    });
  });

  it("rejects an incomplete or malformed RPC row as unavailable", async () => {
    rpc.mockResolvedValue({
      data: [{ ...row, target_workspace_lock_version: 0 }],
      error: null,
    });

    await expect(resolveStaleOwnerWorkspace(input)).rejects.toMatchObject({
      reason: "unavailable",
    });
  });
});
