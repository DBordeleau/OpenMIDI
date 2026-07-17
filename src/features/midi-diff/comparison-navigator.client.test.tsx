import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { diffMidiArrangementsV1 } from "@/features/midi/semantic-diff-v1";
import {
  V3_DIFF_AFTER,
  V3_DIFF_BEFORE,
  V3_IDS,
} from "@/features/studio/manifest/v3.fixtures";
import { MidiDiffComparisonNavigator } from "./comparison-navigator.client";
import { createMidiDiffViewModel } from "./view-model";

function readyModel() {
  const model = createMidiDiffViewModel({
    semanticDiff: diffMidiArrangementsV1(V3_DIFF_BEFORE, V3_DIFF_AFTER),
    before: V3_DIFF_BEFORE,
    after: V3_DIFF_AFTER,
    sideLabels: { before: "Base revision", after: "Submitted version" },
  });
  if (model.status !== "ready") throw new Error("Expected ready fixture");
  return model;
}

describe("MidiDiffComparisonNavigator", () => {
  it("uses keyboard selection, updates details, and labels states without color", () => {
    render(<MidiDiffComparisonNavigator model={readyModel()} />);

    const navigator = screen.getByRole("navigation", {
      name: "Changed tracks and clips",
    });
    const selectedClip = within(navigator).getByRole("button", {
      name: /Bass clip/i,
    });
    expect(screen.getByRole("heading", { name: "Bass clip" })).toBeVisible();

    selectedClip.focus();
    fireEvent.keyDown(selectedClip, { key: "ArrowDown" });
    expect(screen.getByRole("heading", { name: "Lead hook" })).toBeVisible();
    const selectedTrack = within(navigator)
      .getAllByRole("button")
      .find((button) => button.getAttribute("aria-current") === "true");
    expect(selectedTrack).toHaveTextContent("Lead hook");
    expect(document.activeElement).toBe(selectedTrack);

    expect(screen.getAllByText("Added").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Changed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Removed").length).toBeGreaterThan(0);
    expect(screen.queryByText(V3_IDS.patternVersion1)).not.toBeInTheDocument();

    const addedFilter = screen
      .getAllByRole("button")
      .find(
        (button) =>
          button.hasAttribute("aria-pressed") &&
          button.textContent?.includes("Added"),
      );
    expect(addedFilter).toBeDefined();
    if (!addedFilter) return;
    fireEvent.click(addedFilter);
    expect(addedFilter).toHaveAttribute("aria-pressed", "true");
    expect(
      within(navigator).queryByRole("button", { name: /Counter line/i }),
    ).not.toBeInTheDocument();
  });
});
