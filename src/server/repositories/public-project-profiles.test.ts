import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  in: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/anonymous", () => ({
  createSupabaseAnonymousClient: () => ({ from: mocks.from }),
}));

import { getPublicProjectProfiles } from "./public-project-profiles";

describe("public project detail profiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const query = {
      select: () => query,
      in: mocks.in,
      limit: mocks.limit,
    };
    mocks.from.mockReturnValue(query);
    mocks.in.mockReturnValue(query);
  });

  it("loads one bounded safe projection for distinct detail profiles", async () => {
    mocks.limit.mockResolvedValue({
      data: [
        {
          id: "30000000-0000-4000-8000-000000000001",
          username: "Ada",
          display_name: "Ada Beat",
          avatar_config: { version: 1 },
        },
      ],
      error: null,
    });

    const profiles = await getPublicProjectProfiles([
      "30000000-0000-4000-8000-000000000001",
      "30000000-0000-4000-8000-000000000001",
    ]);

    expect(mocks.from).toHaveBeenCalledWith("public_profiles");
    expect(mocks.in).toHaveBeenCalledWith("id", [
      "30000000-0000-4000-8000-000000000001",
    ]);
    expect(mocks.limit).toHaveBeenCalledWith(64);
    expect(profiles.get("30000000-0000-4000-8000-000000000001")).toEqual({
      username: "Ada",
      displayName: "Ada Beat",
      avatarConfig: { version: 1 },
    });
  });

  it("does not synthesize a profile when lifecycle RLS omits the row", async () => {
    mocks.limit.mockResolvedValue({ data: [], error: null });

    const profiles = await getPublicProjectProfiles([
      "30000000-0000-4000-8000-000000000002",
    ]);

    expect(profiles.size).toBe(0);
  });
});
