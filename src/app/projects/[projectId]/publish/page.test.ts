import { describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { requireViewer } from "@/features/auth/guards";
import PublishPage from "./page";

vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));
vi.mock("@/features/auth/guards", () => ({ requireViewer: vi.fn() }));

const projectId = "10000000-0000-4000-8000-000000000001";

describe("retired first-publish route", () => {
  it("authorizes the old destination and redirects to the MIDI Studio", async () => {
    await PublishPage({ params: Promise.resolve({ projectId }) });

    expect(requireViewer).toHaveBeenCalledWith(
      `/projects/${projectId}/publish`,
    );
    expect(redirect).toHaveBeenCalledWith(`/studio/${projectId}`);
  });
});
