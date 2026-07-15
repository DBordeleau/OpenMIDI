import { beforeEach, describe, expect, it, vi } from "vitest";
import { reserveUpload } from "./actions";
import { reserveSourceAsset } from "@/server/repositories/assets";
import { SOURCE_ADMISSION_UNAVAILABLE_MESSAGE } from "./source-admission";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/repositories/assets", () => ({
  reserveSourceAsset: vi.fn(),
  cancelSourceAsset: vi.fn(),
  completeSourceAsset: vi.fn(),
  retrySourceAssetVerification: vi.fn(),
  confirmSourceAssetCredits: vi.fn(),
  cancelWaveformPeakDerivative: vi.fn(),
  finalizeWaveformPeakDerivative: vi.fn(),
  reserveWaveformPeakDerivative: vi.fn(),
}));

const request = {
  byteSize: 1_024,
  filename: "prototype.wav",
  mediaType: "audio/wav",
  durationMs: 1_000,
  requestId: "10000000-0000-4000-8000-000000000001",
};

describe("source reservation action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the atomic reservation command as the admission authority", async () => {
    vi.mocked(reserveSourceAsset).mockResolvedValue({
      data: [
        {
          asset_id: "10000000-0000-4000-8000-000000000002",
          bucket: "source-audio",
          object_path: "actor/asset/source",
          expires_at: "2026-07-16T00:00:00.000Z",
          capacity_warning: false,
        },
      ],
      error: null,
    } as never);

    await expect(reserveUpload(request)).resolves.toMatchObject({
      instruction: { bucket: "source-audio", capacityWarning: false },
    });
    expect(reserveSourceAsset).toHaveBeenCalledOnce();
  });

  it("maps the database lock denial for stale clients", async () => {
    vi.mocked(reserveSourceAsset).mockResolvedValue({
      data: null,
      error: { message: "audio_uploads_unavailable" },
    } as never);

    await expect(reserveUpload(request)).resolves.toEqual({
      error: SOURCE_ADMISSION_UNAVAILABLE_MESSAGE,
    });
  });
});
