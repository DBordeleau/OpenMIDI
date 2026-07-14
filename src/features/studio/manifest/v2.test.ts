import { describe, expect, it } from "vitest";
import { MIDI_SINGLE_TRACK_FIXTURE } from "@/features/midi/fixtures";
import { sha256MidiStemContent } from "@/features/midi/integrity";
import { STUDIO_FIXTURE_MANIFEST } from "./fixtures";
import { mapManifestV1ToV2 } from "./v1-to-v2";
import {
  canonicalizeManifestV2,
  parseMidiStemVersion,
  parseWorkspaceManifestV2,
} from "./v2";

describe("candidate manifest v2", () => {
  it("maps every v1 audio field to one stable v2 clip", () => {
    const mapped = mapManifestV1ToV2(STUDIO_FIXTURE_MANIFEST);
    expect(mapped.projectId).toBe(STUDIO_FIXTURE_MANIFEST.workspaceId);
    expect(mapped.tracks).toHaveLength(2);
    expect(mapped.tracks[0]).toEqual({
      kind: "audio",
      trackId: STUDIO_FIXTURE_MANIFEST.tracks[0].trackId,
      assetId: STUDIO_FIXTURE_MANIFEST.tracks[0].assetId,
      name: STUDIO_FIXTURE_MANIFEST.tracks[0].name,
      instrumentId: STUDIO_FIXTURE_MANIFEST.tracks[0].instrumentId,
      gainDb: STUDIO_FIXTURE_MANIFEST.tracks[0].gainDb,
      pan: STUDIO_FIXTURE_MANIFEST.tracks[0].pan,
      muted: STUDIO_FIXTURE_MANIFEST.tracks[0].muted,
      soloed: STUDIO_FIXTURE_MANIFEST.tracks[0].soloed,
      sortOrder: STUDIO_FIXTURE_MANIFEST.tracks[0].sortOrder,
      clips: [
        {
          clipId: STUDIO_FIXTURE_MANIFEST.tracks[0].trackId,
          positionMs: STUDIO_FIXTURE_MANIFEST.tracks[0].positionMs,
          trimStartMs: STUDIO_FIXTURE_MANIFEST.tracks[0].trimStartMs,
          durationMs: STUDIO_FIXTURE_MANIFEST.tracks[0].durationMs,
        },
      ],
    });
    expect(mapManifestV1ToV2(STUDIO_FIXTURE_MANIFEST)).toEqual(mapped);
    expect(
      mapManifestV1ToV2({ ...STUDIO_FIXTURE_MANIFEST, tempoBpm: 360 }).tempoBpm,
    ).toBe(360);
  });

  it("canonicalizes track, clip, and note order", () => {
    const fixture = MIDI_SINGLE_TRACK_FIXTURE.manifest;
    const withTwoClips = {
      ...fixture,
      durationTicks: fixture.durationTicks * 2,
      tracks: [
        {
          ...fixture.tracks[0],
          clips: [
            {
              ...fixture.tracks[0].clips[0],
              clipId: "10000000-0000-4000-8000-000000009998",
              startTick: fixture.durationTicks,
            },
            fixture.tracks[0].clips[0],
          ],
        },
      ],
    };
    const parsed = parseWorkspaceManifestV2(withTwoClips);
    expect(parsed.tracks[0].clips[0]).toEqual(fixture.tracks[0].clips[0]);
    expect(canonicalizeManifestV2(parsed)).toEqual(parsed);
  });

  it("rejects forged kinds, duplicate clips, and clips outside the project", () => {
    const fixture = MIDI_SINGLE_TRACK_FIXTURE.manifest;
    expect(() =>
      parseWorkspaceManifestV2({
        ...fixture,
        tracks: [{ ...fixture.tracks[0], kind: "storage", assetId: "secret" }],
      }),
    ).toThrow();
    expect(() =>
      parseWorkspaceManifestV2({
        ...fixture,
        tracks: [
          fixture.tracks[0],
          {
            ...fixture.tracks[0],
            trackId: "10000000-0000-4000-8000-000000009999",
            sortOrder: 1,
          },
        ],
      }),
    ).toThrow("Duplicate clipId");
    expect(() =>
      parseWorkspaceManifestV2({
        ...fixture,
        tracks: [
          {
            ...fixture.tracks[0],
            clips: [
              {
                ...fixture.tracks[0].clips[0],
                startTick: fixture.durationTicks,
              },
            ],
          },
        ],
      }),
    ).toThrow("Clip exceeds project duration");
    expect(() =>
      parseWorkspaceManifestV2({ ...fixture, tempoBpm: 301 }),
    ).toThrow("MIDI projects cannot exceed 300 BPM");
  });

  it("produces an order-independent stem content checksum", async () => {
    const stem = [...MIDI_SINGLE_TRACK_FIXTURE.stemVersions.values()][0];
    const reversed = parseMidiStemVersion({
      ...stem,
      notes: [...stem.notes].reverse(),
    });
    expect(await sha256MidiStemContent(reversed)).toBe(
      await sha256MidiStemContent(stem),
    );
    expect(await sha256MidiStemContent(stem)).toMatch(/^[a-f0-9]{64}$/);
  });
});
