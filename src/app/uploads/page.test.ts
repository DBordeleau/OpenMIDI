import { describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { requireViewer } from "@/features/auth/guards";
import UploadsPage from "./page";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/features/auth/guards", () => ({ requireViewer: vi.fn() }));

describe("retired source uploads route", () => {
  it("authorizes the old destination and redirects to Studio", async () => {
    await UploadsPage();

    expect(requireViewer).toHaveBeenCalledWith("/uploads");
    expect(redirect).toHaveBeenCalledWith("/studio");
  });
});
