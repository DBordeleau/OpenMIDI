import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { StudioLauncherProps } from "@/features/studio/components/studio-launcher.client";
import type { ManifestV3 } from "@/features/studio/manifest/v3";
import { ReviewComparison } from "./review-comparison";

vi.mock("@/features/studio/components/studio-launcher.client", () => ({
  StudioLauncher: (props: StudioLauncherProps) => {
    const [mountedMode] = useState(props.mode);
    return <div data-testid="studio-mode">{mountedMode}</div>;
  },
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
const common = {
  viewerId: "10000000-0000-4000-8000-000000000123",
  projectId: "20000000-0000-4000-8000-000000000123",
  projectTitle: "Comparison",
  manifest,
  durationMs: 2000,
  tracks: [],
};

describe("ReviewComparison", () => {
  it("remounts Studio when switching immutable versions", () => {
    render(
      <ReviewComparison
        comparison={
          {
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
          } as never
        }
        base={
          {
            ...common,
            mode: "revision",
            revisionId: "30000000-0000-4000-8000-000000000123",
            revisionNumber: 1,
          } as StudioLauncherProps
        }
        submitted={
          {
            ...common,
            mode: "contributionVersion",
            contributionId: "40000000-0000-4000-8000-000000000123",
            versionId: "50000000-0000-4000-8000-000000000123",
            versionNumber: 1,
          } as StudioLauncherProps
        }
      />,
    );

    expect(screen.getByTestId("studio-mode")).toHaveTextContent(
      "contributionVersion",
    );
    fireEvent.click(screen.getByRole("button", { name: "Base revision" }));
    expect(screen.getByTestId("studio-mode")).toHaveTextContent("revision");
  });
});
