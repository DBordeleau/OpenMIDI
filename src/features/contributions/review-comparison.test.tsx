import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { diffMidiArrangementsV1 } from "@/features/midi/semantic-diff-v1";
import type { ManifestV3 } from "@/features/studio/manifest/v3";
import {
  V3_DIFF_AFTER,
  V3_DIFF_BEFORE,
  V3_IDS,
} from "@/features/studio/manifest/v3.fixtures";
import { ReviewComparison } from "./review-comparison";

vi.mock("@/features/midi-diff/paired-audition.client", () => ({
  MidiDiffPairedAudition: () => <div data-testid="paired-audition" />,
}));

const manifest: ManifestV3 = {
  manifestVersion: 3,
  engine: "jam-session-midi",
  engineVersion: "jam-session-midi-3_tone-15.1.22_presets-1",
  projectId: "20000000-0000-4000-8000-000000000123",
  tempoBpm: 120,
  timeSignature: { numerator: 4, denominator: 4 },
  musicalKey: null,
  ppq: 480,
  durationTicks: 1920,
  tracks: [],
};
describe("ReviewComparison", () => {
  it("replaces the Studio launcher with paired read-only audition and renders unchanged input", async () => {
    render(
      <ReviewComparison
        comparison={{
          baseArrangementVersionId: "60000000-0000-4000-8000-000000000123",
          submittedArrangementVersionId: "70000000-0000-4000-8000-000000000123",
          base: { manifest, patternVersions: [] },
          submitted: { manifest, patternVersions: [] },
          semanticDiff: {
            algorithmVersion: "jam-session-midi-semantic-diff-1",
            unchanged: true,
            metadata: [],
            tracks: [],
            clips: [],
            notes: [],
            lineage: [],
          },
          patternAttributions: [],
        }}
      />,
    );

    expect(await screen.findByTestId("paired-audition")).toBeVisible();
    expect(screen.queryByTestId("studio-mode")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "No musical changes found" }),
    ).toBeVisible();
  });

  it("renders an actionable unavailable state", () => {
    render(<ReviewComparison comparison={null} />);
    expect(
      screen.getByRole("heading", { name: "Comparison unavailable" }),
    ).toBeVisible();
  });

  it("keeps pattern UUIDs in technical details instead of primary attribution", () => {
    const studioPattern = (
      pattern: (typeof V3_DIFF_AFTER.patternVersions)[number],
    ) => ({
      ...pattern,
      name: "Pattern",
      presetId: "warm-keys",
      presetVersion: 1,
    });
    const { container } = render(
      <ReviewComparison
        comparison={{
          baseArrangementVersionId: "60000000-0000-4000-8000-000000000123",
          submittedArrangementVersionId: "70000000-0000-4000-8000-000000000123",
          base: {
            manifest: V3_DIFF_BEFORE.manifest,
            patternVersions: V3_DIFF_BEFORE.patternVersions.map(studioPattern),
          },
          submitted: {
            manifest: V3_DIFF_AFTER.manifest,
            patternVersions: V3_DIFF_AFTER.patternVersions.map(studioPattern),
          },
          semanticDiff: diffMidiArrangementsV1(V3_DIFF_BEFORE, V3_DIFF_AFTER),
          patternAttributions: [],
        }}
      />,
    );

    const rendered = within(container);
    const attribution = rendered
      .getByRole("heading", { name: "Pattern attribution" })
      .closest("section");
    expect(attribution).not.toBeNull();
    expect(
      within(attribution!).queryByText(V3_IDS.patternVersion1),
    ).not.toBeInTheDocument();
    expect(
      within(attribution!).getAllByText(/Pattern version [12]/),
    ).not.toHaveLength(0);

    const technicalDetails = rendered
      .getByText("Technical comparison details")
      .closest("details");
    expect(technicalDetails).not.toBeNull();
    expect(
      within(technicalDetails!).getByText(
        `Pattern version ID: ${V3_IDS.patternVersion1}`,
      ),
    ).toBeInTheDocument();
  });
});
