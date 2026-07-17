import { describe, expect, it } from "vitest";
import {
  V3_MANIFEST_BEFORE,
  V3_PATTERN_VERSION_1,
} from "@/features/studio/manifest/v3.fixtures";
import { schedulePublicMidiRevision } from "./schedule";

describe("public MIDI scheduling", () => {
  it("deterministically resolves structured v3 clips without network media", () => {
    const patterns = new Map([
      [V3_PATTERN_VERSION_1.midiPatternVersionId, V3_PATTERN_VERSION_1],
    ]);
    const first = schedulePublicMidiRevision(V3_MANIFEST_BEFORE, patterns);
    const second = schedulePublicMidiRevision(V3_MANIFEST_BEFORE, patterns);

    expect(second).toEqual(first);
    expect(first).toHaveLength(4);
    expect(first.map((event) => event.startTick)).toEqual([0, 240, 960, 1200]);
    expect(first.every((event) => event.presetId.length > 0)).toBe(true);
    expect(JSON.stringify(first)).not.toMatch(/signedUrl|storage/i);
  });

  it("honors solo and mute state before scheduling", () => {
    const patterns = new Map([
      [V3_PATTERN_VERSION_1.midiPatternVersionId, V3_PATTERN_VERSION_1],
    ]);
    const manifest = {
      ...V3_MANIFEST_BEFORE,
      tracks: V3_MANIFEST_BEFORE.tracks.map((track, index) => ({
        ...track,
        soloed: index === 0,
      })),
    };
    expect(
      new Set(
        schedulePublicMidiRevision(manifest, patterns).map(
          ({ trackId }) => trackId,
        ),
      ),
    ).toEqual(new Set([manifest.tracks[0]!.trackId]));
  });
});
