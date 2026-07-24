import { describe, expect, it } from "vitest";
import {
  formatStudioClipDuration,
  studioClipFailureMessage,
} from "./presentation";

describe("Studio clip presentation", () => {
  it("keeps stable musician-facing recovery copy for every action failure", () => {
    expect(studioClipFailureMessage("unauthenticated")).toContain("Sign in");
    expect(studioClipFailureMessage("actor_ineligible")).toContain("account");
    expect(studioClipFailureMessage("source_unavailable")).toContain(
      "exact pattern version",
    );
    expect(studioClipFailureMessage("saved_source_unavailable")).toContain(
      "bookmark",
    );
    expect(studioClipFailureMessage("workspace_unavailable")).toContain(
      "workspace",
    );
    expect(studioClipFailureMessage("workspace_stale")).toContain("reload");
    expect(studioClipFailureMessage("request_mismatch")).toContain(
      "no longer matches",
    );
    expect(studioClipFailureMessage("track_limit")).toContain("tracks");
    expect(studioClipFailureMessage("note_limit")).toContain("note limit");
    expect(studioClipFailureMessage("invalid_start_tick")).toContain(
      "playhead",
    );
    expect(studioClipFailureMessage("invalid_request")).toContain(
      "could not be checked",
    );
    expect(studioClipFailureMessage("unavailable")).toContain("tune up");
  });

  it("describes whole and fractional musical lengths without exposing ticks", () => {
    expect(formatStudioClipDuration(480)).toBe("1 beat");
    expect(formatStudioClipDuration(1_920)).toBe("4 beats");
    expect(formatStudioClipDuration(720)).toBe("1.5 beats");
  });
});
