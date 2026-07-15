import { beforeEach, describe, expect, it, vi } from "vitest";
import LegacyStudioPage from "./page";
import { redirect } from "next/navigation";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

describe("legacy Studio route", () => {
  beforeEach(() => vi.mocked(redirect).mockReset());

  it("redirects to the canonical selected-project route", async () => {
    await LegacyStudioPage({
      params: Promise.resolve({
        projectId: "10000000-0000-4000-8000-000000000123",
      }),
    });

    expect(redirect).toHaveBeenCalledWith(
      "/studio/10000000-0000-4000-8000-000000000123",
    );
  });
});
