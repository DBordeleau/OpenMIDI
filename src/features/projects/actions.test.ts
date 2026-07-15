import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProjectAction } from "./actions";
import { createProject } from "@/server/repositories/projects";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/repositories/projects", () => ({
  createProject: vi.fn(),
  updateProjectMetadata: vi.fn(),
}));

const requestId = "10000000-0000-4000-8000-000000000001";
const projectId = "10000000-0000-4000-8000-000000000002";

function validFormData() {
  const data = new FormData();
  data.set("title", "Night Signals");
  data.set("description", "A shared MIDI sketch");
  data.set("bpm", "120");
  data.set("musicalKey", "c-minor");
  data.set("timeSignatureNumerator", "4");
  data.set("timeSignatureDenominator", "4");
  data.set("licenseCode", "all-rights-reserved");
  data.set("primaryGenreId", "");
  return data;
}

describe("shared project creation action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the atomic MIDI creator and opens the canonical Studio route", async () => {
    vi.mocked(createProject).mockResolvedValue({
      data: [{ project_id: projectId }],
      error: null,
    } as never);

    await createProjectAction(requestId, {}, validFormData());

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Night Signals", bpm: 120 }),
      requestId,
    );
    expect(revalidatePath).toHaveBeenCalledWith("/studio", "layout");
    expect(redirect).toHaveBeenCalledWith(`/studio/${projectId}`);
  });

  it("keeps conflicting request-id reuse explicit", async () => {
    vi.mocked(createProject).mockResolvedValue({
      data: null,
      error: { code: "PT409" },
    } as never);

    await expect(
      createProjectAction(requestId, {}, validFormData()),
    ).resolves.toEqual({
      message: "This creation request was already used with different details.",
    });
    expect(redirect).not.toHaveBeenCalled();
  });
});
