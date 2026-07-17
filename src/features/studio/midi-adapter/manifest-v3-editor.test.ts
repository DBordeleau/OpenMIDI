import { describe, expect, it } from "vitest";
import {
  MIDI_V3_ENGINE_ID,
  MIDI_V3_ENGINE_VERSION,
} from "@/features/midi/domain-v3";
import type { WorkspaceManifestV3 } from "../manifest/v3";
import { toEditorManifest, toWorkspaceManifestV3 } from "./manifest-v3-editor";

const manifest: WorkspaceManifestV3 = {
  manifestVersion: 3,
  engine: MIDI_V3_ENGINE_ID,
  engineVersion: MIDI_V3_ENGINE_VERSION,
  projectId: "00000000-0000-4000-8000-000000000001",
  workspaceId: "00000000-0000-4000-8000-000000000002",
  tempoBpm: 124,
  timeSignature: { numerator: 4, denominator: 4 },
  musicalKey: "c-minor",
  ppq: 480,
  durationTicks: 3840,
  tracks: [
    {
      trackId: "00000000-0000-4000-8000-000000000003",
      sortOrder: 0,
      name: "Warm chords",
      presetId: "warm-keys",
      presetVersion: 1,
      gainDb: -2,
      pan: 0.1,
      muted: false,
      soloed: false,
      clips: [
        {
          clipId: "00000000-0000-4000-8000-000000000004",
          midiPatternVersionId: "00000000-0000-4000-8000-000000000005",
          startTick: 960,
          durationTicks: 1920,
          sourceStartTick: 0,
          loop: true,
        },
      ],
    },
  ],
};

describe("manifest-v3 Studio editor boundary", () => {
  it("round trips the complete MIDI arrangement", () => {
    const editor = toEditorManifest(manifest);
    expect(toWorkspaceManifestV3(editor, manifest)).toEqual(manifest);
  });
});
