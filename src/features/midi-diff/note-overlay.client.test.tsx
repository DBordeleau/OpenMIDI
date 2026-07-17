import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { diffMidiArrangementsV1 } from "@/features/midi/semantic-diff-v1";
import {
  V3_DIFF_AFTER,
  V3_DIFF_BEFORE,
  V3_IDS,
} from "@/features/studio/manifest/v3.fixtures";
import { MidiDiffNoteOverlay } from "./note-overlay.client";
import { createMidiDiffViewModel } from "./view-model";

function changedClip() {
  const model = createMidiDiffViewModel({
    semanticDiff: diffMidiArrangementsV1(V3_DIFF_BEFORE, V3_DIFF_AFTER),
    before: V3_DIFF_BEFORE,
    after: V3_DIFF_AFTER,
    sideLabels: { before: "Base revision", after: "Submitted version" },
  });
  if (model.status !== "ready") throw new Error("Expected ready fixture");
  const clip = model.tracks
    .flatMap((track) => track.clips)
    .find((item) => item.clipId === V3_IDS.clipA);
  if (!clip) throw new Error("Expected changed clip");
  return clip;
}

describe("MidiDiffNoteOverlay", () => {
  it("renders derived counts, labels, legend semantics, filters, and equivalent text", () => {
    render(
      <MidiDiffNoteOverlay
        clip={changedClip()}
        sideLabels={{ before: "Base revision", after: "Submitted version" }}
      />,
    );

    expect(screen.getByText("Selected track · Lead hook")).toBeVisible();
    expect(screen.getByRole("button", { name: "+ 1 Added" })).toBeVisible();
    expect(screen.getByRole("button", { name: "~ 1 Changed" })).toBeVisible();
    expect(screen.getByRole("button", { name: "− 1 Removed" })).toBeVisible();
    const legend = screen.getByRole("list", { name: "Note comparison legend" });
    expect(within(legend).getByText("dashed outline")).toBeVisible();
    expect(
      within(legend).getByText("before outline + after fill"),
    ).toBeVisible();
    expect(screen.getByText(/Base revision: C4/)).toBeVisible();
    expect(screen.getByText(/Submitted version: C♯4/)).toBeVisible();

    const added = screen.getByRole("button", { name: "+ 1 Added" });
    added.focus();
    expect(document.activeElement).toBe(added);
    fireEvent.click(added);
    expect(added).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/\+ Added: G4/)).toBeVisible();
    expect(screen.queryByText(/~ Changed\./)).not.toBeInTheDocument();
  });
});
