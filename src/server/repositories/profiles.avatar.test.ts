import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AVATAR_OPTIONS } from "@/features/profiles/avatar/contract";
import { resetViewerAvatarConfig, saveViewerAvatarConfig } from "./profiles";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ rpc }),
}));
vi.mock("@/lib/supabase/anonymous", () => ({
  createSupabaseAnonymousClient: vi.fn(),
}));
vi.mock("@/server/repositories/discovery", () => ({
  getDiscoveryVersion: vi.fn(),
}));

const storedConfig = {
  version: 1 as const,
  seed: "30000000-0000-4000-8000-000000000001",
  options: DEFAULT_AVATAR_OPTIONS,
};

describe("avatar profile repository", () => {
  beforeEach(() => rpc.mockReset());

  it("passes optimistic revision and returns the exact validated stored config", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          avatar_config: storedConfig,
          avatar_config_revision: 9,
          avatar_updated_at: "2026-07-22T12:00:00Z",
        },
      ],
      error: null,
    });

    await expect(
      saveViewerAvatarConfig({
        expectedRevision: 8,
        options: DEFAULT_AVATAR_OPTIONS,
      }),
    ).resolves.toEqual({
      data: { avatarConfig: storedConfig, avatarConfigRevision: 9 },
      error: null,
    });
    expect(rpc).toHaveBeenCalledWith("save_own_avatar_config", {
      p_options: DEFAULT_AVATAR_OPTIONS,
      p_expected_revision: 8,
    });
  });

  it("rejects malformed database responses instead of displaying them", async () => {
    rpc.mockResolvedValue({
      data: [{ avatar_config: { version: 2 }, avatar_config_revision: 9 }],
      error: null,
    });

    await expect(
      saveViewerAvatarConfig({
        expectedRevision: 8,
        options: DEFAULT_AVATAR_OPTIONS,
      }),
    ).rejects.toThrow("avatar_config_response_invalid");
  });

  it("requires reset to return null and preserves its new revision", async () => {
    rpc.mockResolvedValue({
      data: [{ avatar_config: null, avatar_config_revision: 10 }],
      error: null,
    });

    await expect(
      resetViewerAvatarConfig({ expectedRevision: 9 }),
    ).resolves.toEqual({
      data: { avatarConfig: null, avatarConfigRevision: 10 },
      error: null,
    });
  });
});
