import { describe, expect, it } from "vitest";
import { buildPreviewSchedule } from "./preview-schedule";
import type { AudioQuickPreviewResponse } from "../preview-contract";

const tracks: AudioQuickPreviewResponse["tracks"] = [
  {
    trackId: "10000000-0000-4000-8000-000000000001",
    signedUrl: "https://example.test/one",
    positionMs: 1_000,
    trimStartMs: 250,
    durationMs: 2_000,
    gainDb: 0,
    pan: -0.5,
    muted: false,
    soloed: false,
  },
];

describe("buildPreviewSchedule", () => {
  it("schedules a future track from its trim point", () => {
    expect(buildPreviewSchedule(tracks, 0)).toEqual([
      {
        trackIndex: 0,
        delaySeconds: 1,
        offsetSeconds: 0.25,
        durationSeconds: 2,
        gain: 1,
        pan: -0.5,
      },
    ]);
  });

  it("resumes inside a track without replaying elapsed audio", () => {
    expect(buildPreviewSchedule(tracks, 1_500)[0]).toMatchObject({
      delaySeconds: 0,
      offsetSeconds: 0.75,
      durationSeconds: 1.5,
    });
  });

  it("honors mute and solo state", () => {
    const soloed = [
      { ...tracks[0]!, soloed: false },
      {
        ...tracks[0]!,
        trackId: "10000000-0000-4000-8000-000000000002",
        soloed: true,
      },
    ];
    expect(
      buildPreviewSchedule(soloed, 0).map((item) => item.trackIndex),
    ).toEqual([1]);
  });
});
