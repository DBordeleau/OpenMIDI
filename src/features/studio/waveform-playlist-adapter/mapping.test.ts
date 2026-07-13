import { describe, expect, it } from "vitest";
import { STUDIO_FIXTURE_MANIFEST } from "../manifest/fixtures";
import {
  decibelsToGain,
  editorTracksToManifest,
  gainToDecibels,
  manifestTrackToClipTrack,
  millisecondsToSamples,
  samplesToMilliseconds,
} from "./mapping";

const buffer = { length: 96_000, sampleRate: 48_000 } as AudioBuffer;

describe("Waveform Playlist mapping", () => {
  it("converts persistence units deterministically", () => {
    expect(millisecondsToSamples(500, 48_000)).toBe(24_000);
    expect(samplesToMilliseconds(24_000, 48_000)).toBe(500);
    expect(gainToDecibels(decibelsToGain(-6))).toBeCloseTo(-6, 10);
  });

  it("preserves stable Jam Session IDs through an editor round trip", () => {
    const editorTracks = STUDIO_FIXTURE_MANIFEST.tracks.map((track) =>
      manifestTrackToClipTrack(track, buffer),
    );
    expect(editorTracks.map(({ id }) => id)).toEqual([
      "track-pulse",
      "track-chime",
    ]);
    expect(
      editorTracksToManifest(STUDIO_FIXTURE_MANIFEST, editorTracks),
    ).toEqual(STUDIO_FIXTURE_MANIFEST);
  });

  it("maps only the promoted editor mutation", () => {
    const editorTracks = STUDIO_FIXTURE_MANIFEST.tracks.map((track) =>
      manifestTrackToClipTrack(track, buffer),
    );
    editorTracks[0].pan = 0.75;
    const exported = editorTracksToManifest(
      STUDIO_FIXTURE_MANIFEST,
      editorTracks,
    );
    expect(exported.tracks[0]).toEqual({
      ...STUDIO_FIXTURE_MANIFEST.tracks[0],
      pan: 0.75,
    });
    expect(exported.tracks[1]).toEqual(STUDIO_FIXTURE_MANIFEST.tracks[1]);
  });
});
