import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MidiLibraryHistoryVersion } from "./types";
import { MidiLibraryPatternComparisonView } from "./pattern-version-comparison.client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/features/midi-diff/note-overlay.client", () => ({
  MidiDiffNoteOverlay: () => <div>Shared note overlay</div>,
}));
vi.mock("@/features/midi-diff/paired-audition.client", () => ({
  MidiDiffPairedAudition: () => <div>Paired audition</div>,
}));

const patternId = "40000000-0000-4000-8000-000000000001";

function version(
  midiPatternVersionId: string,
  versionNumber: number,
): MidiLibraryHistoryVersion {
  return {
    midiPatternVersionId,
    midiPatternId: patternId,
    versionNumber,
    creatorId: "40000000-0000-4000-8000-000000000002",
    creatorCreditName: "History creator",
    parentMidiPatternVersionId: null,
    sourceMidiPatternVersionId: null,
    ppq: 480,
    durationTicks: 960,
    noteCount: 0,
    contentSha256: "a".repeat(64),
    reuseLicenseCode: null,
    reuseLicenseVersion: null,
    reuseLicenseUrl: null,
    createdAt: "2026-07-18T06:00:00.000Z",
    notes: [],
  };
}

describe("library pattern comparison selector", () => {
  it("keeps an explicitly authorized version selectable outside the bounded history window", () => {
    const listed = version("40000000-0000-4000-8000-000000000003", 1);
    const selectedOutsideWindow = version(
      "40000000-0000-4000-8000-000000000004",
      101,
    );
    render(
      <MidiLibraryPatternComparisonView
        listingId="40000000-0000-4000-8000-000000000005"
        title="Bounded history"
        preset={{ id: "soft-lead", version: 1 }}
        history={[listed]}
        comparison={{
          listingId: "40000000-0000-4000-8000-000000000005",
          from: listed,
          to: selectedOutsideWindow,
        }}
      />,
    );

    expect(screen.getByLabelText("To version")).toHaveValue(
      selectedOutsideWindow.midiPatternVersionId,
    );
    expect(screen.getAllByRole("option", { name: /Version 101/ })).toHaveLength(
      2,
    );
  });
});
