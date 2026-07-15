import { describe, expect, it } from "vitest";
import { moveSelection } from "./selection";
import type { ArrangerTrack } from "./view-model";

describe("arranger selection", () => {
  it("traverses tracks and every clip in stable visual order", () => {
    const tracks = [
      { trackId: "a", clips: [{ clipId: "a1" }, { clipId: "a2" }] },
      { trackId: "b", clips: [{ clipId: "b1" }] },
    ] as ArrangerTrack[];
    expect(moveSelection(tracks, null, 1)).toEqual({
      kind: "track",
      trackId: "a",
    });
    expect(moveSelection(tracks, { kind: "track", trackId: "a" }, 1)).toEqual({
      kind: "clip",
      trackId: "a",
      clipId: "a1",
    });
    expect(
      moveSelection(tracks, { kind: "clip", trackId: "a", clipId: "a1" }, 1),
    ).toEqual({ kind: "clip", trackId: "a", clipId: "a2" });
    expect(moveSelection(tracks, { kind: "track", trackId: "b" }, -1)).toEqual({
      kind: "clip",
      trackId: "a",
      clipId: "a2",
    });
  });
});
