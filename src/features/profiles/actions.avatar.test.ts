import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AVATAR_OPTIONS } from "./avatar/contract";
import { resetAvatarAction, saveAvatarAction } from "./actions";

const revalidatePath = vi.hoisted(() => vi.fn());
const getViewerProfile = vi.hoisted(() => vi.fn());
const saveViewerAvatarConfig = vi.hoisted(() => vi.fn());
const resetViewerAvatarConfig = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/repositories/profiles", () => ({
  getViewerProfile,
  saveViewerAvatarConfig,
  resetViewerAvatarConfig,
  saveViewerProfile: vi.fn(),
}));

const savedConfig = {
  version: 1 as const,
  seed: "30000000-0000-4000-8000-000000000001",
  options: DEFAULT_AVATAR_OPTIONS,
};

describe("avatar server actions", () => {
  beforeEach(() => {
    revalidatePath.mockReset();
    getViewerProfile.mockReset();
    saveViewerAvatarConfig.mockReset();
    resetViewerAvatarConfig.mockReset();
    getViewerProfile.mockResolvedValue({ username: "ada" });
  });

  it("rejects invalid input before reaching the repository", async () => {
    const result = await saveAvatarAction({
      expectedRevision: 0,
      options: { ...DEFAULT_AVATAR_OPTIONS, backgroundColor: "#ABCDEF" },
    });

    expect(result).toMatchObject({ ok: false, kind: "invalid" });
    expect(saveViewerAvatarConfig).not.toHaveBeenCalled();
  });

  it("returns exact stored configuration and revalidates every display path", async () => {
    saveViewerAvatarConfig.mockResolvedValue({
      data: { avatarConfig: savedConfig, avatarConfigRevision: 3 },
      error: null,
    });

    await expect(
      saveAvatarAction({
        expectedRevision: 2,
        options: DEFAULT_AVATAR_OPTIONS,
      }),
    ).resolves.toEqual({
      ok: true,
      avatarConfig: savedConfig,
      avatarConfigRevision: 3,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/settings/avatar");
    expect(revalidatePath).toHaveBeenCalledWith("/settings/profile");
    expect(revalidatePath).toHaveBeenCalledWith("/@ada");
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("maps stale revisions to actionable bounded feedback", async () => {
    saveViewerAvatarConfig.mockResolvedValue({
      data: null,
      error: { code: "PT409" },
    });

    const result = await saveAvatarAction({
      expectedRevision: 2,
      options: DEFAULT_AVATAR_OPTIONS,
    });
    expect(result).toMatchObject({ ok: false, kind: "stale" });
    if (!result.ok) expect(result.message).toContain("another tab");
  });

  it("returns the reset revision and null configuration", async () => {
    resetViewerAvatarConfig.mockResolvedValue({
      data: { avatarConfig: null, avatarConfigRevision: 7 },
      error: null,
    });

    await expect(resetAvatarAction({ expectedRevision: 6 })).resolves.toEqual({
      ok: true,
      avatarConfig: null,
      avatarConfigRevision: 7,
    });
  });
});
