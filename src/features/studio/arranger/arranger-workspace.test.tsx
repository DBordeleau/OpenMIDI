import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { parseWorkspaceManifestV2 } from "../manifest/v2";
import { ArrangerWorkspace } from "./arranger-workspace";

const uuid = (suffix: number) =>
  `00000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`;

describe("ArrangerWorkspace", () => {
  it("renders all clips, exposes selection summaries, and keeps read-only mixer controls denied", () => {
    const versionId = uuid(8);
    const manifest = parseWorkspaceManifestV2({
      manifestVersion: 2,
      engine: "jam-session-composite",
      engineVersion: "jam-session-composite-2_tone-15.1.22",
      projectId: uuid(1),
      tempoBpm: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      durationTicks: 2_880,
      tracks: [
        {
          kind: "midi",
          trackId: uuid(2),
          name: "Keys",
          instrumentId: null,
          presetId: "warm-poly-v1",
          presetVersion: 1,
          gainDb: 0,
          pan: 0,
          muted: false,
          soloed: false,
          sortOrder: 0,
          clips: [
            {
              clipId: uuid(3),
              midiStemVersionId: versionId,
              startTick: 0,
              durationTicks: 480,
              sourceStartTick: 0,
              loop: false,
            },
            {
              clipId: uuid(4),
              midiStemVersionId: versionId,
              startTick: 960,
              durationTicks: 480,
              sourceStartTick: 0,
              loop: false,
            },
          ],
        },
      ],
    });
    render(
      <ArrangerWorkspace
        manifest={manifest}
        midiVersions={[
          {
            stemVersionId: versionId,
            stemId: uuid(9),
            version: 1,
            name: "Keys take",
            noteCount: 1,
            durationTicks: 480,
            defaultPresetId: "warm-poly-v1",
            defaultPresetVersion: 1,
            parentStemVersionId: null,
            creatorCreditName: "Ada",
            createdAt: "2026-07-15T00:00:00.000Z",
            creatorId: uuid(10),
            ppq: 480,
            notes: [
              {
                noteId: uuid(11),
                pitch: 64,
                velocity: 100,
                startTick: 0,
                durationTicks: 240,
              },
            ],
            contentSha256: "a".repeat(64),
          },
        ]}
        trackCredits={[
          { trackId: uuid(2), instrumentName: null, creditName: "Ada" },
        ]}
        audioSummaries={new Map()}
        editable={false}
        playing={false}
        playheadTick={0}
        onTogglePlayback={vi.fn()}
        onSeek={vi.fn()}
        onTrackPatch={vi.fn()}
        onClipPatch={vi.fn()}
        onMoveTrack={vi.fn()}
        onRemoveTrack={vi.fn()}
        onReplaceVersion={vi.fn()}
        actionRegion={<button type="button">Actions</button>}
        statusRegion={<span>Read only</span>}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Arrangement workspace" }),
    ).toBeVisible();
    const clips = screen.getAllByRole("button", { name: /MIDI clip on Keys/ });
    expect(clips).toHaveLength(2);
    fireEvent.click(clips[1]!);
    expect(
      screen.getByRole("complementary", { name: "Inspector" }),
    ).toHaveTextContent("Keys clip");
    expect(screen.getByLabelText("Start tick")).toHaveValue(960);
    expect(screen.getByRole("button", { name: "Mute Keys" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move Keys down" }),
    ).toBeDisabled();
  });
});
