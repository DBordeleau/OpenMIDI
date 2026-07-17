import { describe, expect, it } from "vitest";
import { parseWorkspaceManifestV2 } from "../manifest/v2";
import { buildArrangerViewModel } from "./view-model";

const ids = {
  project: "00000000-0000-4000-8000-000000000001",
  midiTrack: "00000000-0000-4000-8000-000000000003",
  midiClipA: "00000000-0000-4000-8000-000000000007",
  midiClipB: "00000000-0000-4000-8000-000000000008",
  version: "00000000-0000-4000-8000-000000000009",
  stem: "00000000-0000-4000-8000-000000000010",
  creator: "00000000-0000-4000-8000-000000000011",
  note: "00000000-0000-4000-8000-000000000012",
};

describe("arranger view model", () => {
  it("keeps every stable track and clip identity and derives bounded MIDI notes", () => {
    const manifest = parseWorkspaceManifestV2({
      manifestVersion: 2,
      engine: "jam-session-composite",
      engineVersion: "jam-session-composite-2_tone-15.1.22",
      projectId: ids.project,
      tempoBpm: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      durationTicks: 3_840,
      tracks: [
        {
          kind: "midi",
          trackId: ids.midiTrack,
          name: "MIDI",
          instrumentId: null,
          presetId: "warm-poly-v1",
          presetVersion: 1,
          gainDb: -3,
          pan: 0.2,
          muted: false,
          soloed: false,
          sortOrder: 0,
          clips: [
            {
              clipId: ids.midiClipA,
              midiStemVersionId: ids.version,
              startTick: 0,
              durationTicks: 480,
              sourceStartTick: 0,
              loop: false,
            },
            {
              clipId: ids.midiClipB,
              midiStemVersionId: ids.version,
              startTick: 960,
              durationTicks: 240,
              sourceStartTick: 80,
              loop: false,
            },
          ],
        },
      ],
    });
    const view = buildArrangerViewModel({
      manifest,
      trackCredits: [
        {
          trackId: ids.midiTrack,
          instrumentName: null,
          creditName: "Fallback artist",
        },
      ],
      midiVersions: [
        {
          stemVersionId: ids.version,
          stemId: ids.stem,
          version: 2,
          name: "Phrase",
          noteCount: 1,
          defaultPresetId: "warm-poly-v1",
          defaultPresetVersion: 1,
          parentStemVersionId: null,
          creatorCreditName: "MIDI artist",
          creatorId: ids.creator,
          ppq: 480,
          durationTicks: 480,
          notes: [
            {
              noteId: ids.note,
              pitch: 60,
              velocity: 100,
              startTick: 100,
              durationTicks: 300,
            },
          ],
          contentSha256: "a".repeat(64),
          createdAt: "2026-07-15T00:00:00.000Z",
        },
      ],
    });

    expect(
      view.tracks.flatMap((track) => track.clips.map((clip) => clip.clipId)),
    ).toEqual([ids.midiClipA, ids.midiClipB]);
    expect(view.tracks[0]?.clips[1]).toMatchObject({
      startTick: 960,
      durationTicks: 240,
    });
    expect(view.tracks[0]?.clips[1]?.notes[0]).toMatchObject({
      startTick: 980,
      durationTicks: 220,
    });
    expect(view.tracks[0]?.clips[0]?.creditName).toBe("MIDI artist");
  });
});
