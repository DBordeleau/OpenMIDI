import { describe, expect, it } from "vitest";
import {
  parseWorkspaceManifestV2,
  type WorkspaceManifestV2,
} from "../manifest/v2";
import {
  applyArrangementCommand,
  copyArrangementClip,
  snapArrangementTick,
} from "./commands";

const uuid = (suffix: number) =>
  `00000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`;

const midiVersionId = uuid(20);
const context = {
  midiVersionDurations: new Map([[midiVersionId, 960]]),
};

function fixture(): WorkspaceManifestV2 {
  return parseWorkspaceManifestV2({
    manifestVersion: 2,
    engine: "jam-session-composite",
    engineVersion: "jam-session-composite-2_tone-15.1.22",
    projectId: uuid(1),
    tempoBpm: 120,
    timeSignature: { numerator: 4, denominator: 4 },
    durationTicks: 4_800,
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
            midiStemVersionId: midiVersionId,
            startTick: 0,
            durationTicks: 480,
            sourceStartTick: 0,
            loop: false,
          },
        ],
      },
      {
        kind: "midi",
        trackId: uuid(4),
        name: "Bass",
        instrumentId: null,
        presetId: "mono-bass-v1",
        presetVersion: 1,
        gainDb: -3,
        pan: 0,
        muted: false,
        soloed: false,
        sortOrder: 1,
        clips: [
          {
            clipId: uuid(5),
            midiStemVersionId: midiVersionId,
            startTick: 0,
            sourceStartTick: 0,
            durationTicks: 480,
            loop: false,
          },
        ],
      },
    ],
  });
}

describe("arrangement commands", () => {
  it("reorders tracks and moves MIDI clips on the canonical timeline", () => {
    let manifest = fixture();
    manifest = applyArrangementCommand(
      manifest,
      { type: "reorderTrack", trackId: uuid(4), targetIndex: 0 },
      context,
    );
    manifest = applyArrangementCommand(
      manifest,
      { type: "moveClip", trackId: uuid(2), clipId: uuid(3), startTick: 960 },
      context,
    );
    manifest = applyArrangementCommand(
      manifest,
      { type: "moveClip", trackId: uuid(4), clipId: uuid(5), startTick: 480 },
      context,
    );

    expect(
      manifest.tracks.map(({ trackId, sortOrder }) => [trackId, sortOrder]),
    ).toEqual([
      [uuid(4), 0],
      [uuid(2), 1],
    ]);
    expect(manifest.tracks[1]?.clips[0]).toMatchObject({ startTick: 960 });
    expect(manifest.tracks[0]?.clips[0]).toMatchObject({ startTick: 480 });
  });

  it("copies, pastes, and deletes with fresh stable IDs", () => {
    let manifest = fixture();
    const clipboard = copyArrangementClip(manifest, uuid(2), uuid(3));
    manifest = applyArrangementCommand(
      manifest,
      {
        type: "pasteClip",
        targetTrackId: uuid(2),
        clipboard,
        newClipId: uuid(7),
      },
      context,
    );
    manifest = applyArrangementCommand(
      manifest,
      { type: "deleteMidiClip", trackId: uuid(2), clipId: uuid(7) },
      context,
    );

    const midi = manifest.tracks.find((track) => track.trackId === uuid(2))!;
    expect(midi.clips.map(({ clipId }) => clipId)).toEqual([uuid(3)]);
  });

  it("duplicates a complete MIDI track into a new lane with fresh stable IDs", () => {
    const manifest = applyArrangementCommand(
      fixture(),
      {
        type: "duplicateMidiTrack",
        trackId: uuid(2),
        newTrackId: uuid(6),
        newClipIds: [uuid(7)],
      },
      context,
    );

    expect(manifest.tracks[2]).toMatchObject({
      kind: "midi",
      trackId: uuid(6),
      name: "Keys copy",
      presetId: "warm-poly-v1",
      gainDb: 0,
      sortOrder: 2,
      clips: [
        {
          clipId: uuid(7),
          midiStemVersionId: midiVersionId,
          startTick: 0,
        },
      ],
    });
  });

  it("materializes a pending MIDI lane and honors an explicit paste position", () => {
    const clipboard = copyArrangementClip(fixture(), uuid(2), uuid(3));
    if (clipboard.kind !== "midi") throw new Error("Expected MIDI clipboard");
    let manifest = applyArrangementCommand(
      fixture(),
      {
        type: "materializeMidiTrack",
        trackId: uuid(10),
        name: "Counter melody",
        clipboard,
        newClipId: uuid(11),
        startTick: 1_440,
      },
      context,
    );
    manifest = applyArrangementCommand(
      manifest,
      {
        type: "pasteClip",
        targetTrackId: uuid(10),
        clipboard,
        newClipId: uuid(12),
        startTick: 0,
      },
      context,
    );

    const track = manifest.tracks.find(({ trackId }) => trackId === uuid(10));
    expect(track).toMatchObject({
      kind: "midi",
      name: "Counter melody",
      presetId: "warm-poly-v1",
    });
    expect(track?.clips).toMatchObject([
      { clipId: uuid(12), startTick: 0, midiStemVersionId: midiVersionId },
      { clipId: uuid(11), startTick: 1_440, midiStemVersionId: midiVersionId },
    ]);
  });

  it("extends the project duration when paste uses the next opening", () => {
    let manifest = parseWorkspaceManifestV2({
      ...fixture(),
      durationTicks: 960,
    });
    const clipboard = copyArrangementClip(manifest, uuid(2), uuid(3));
    for (const clipId of [uuid(13), uuid(14)]) {
      manifest = applyArrangementCommand(
        manifest,
        {
          type: "pasteClip",
          targetTrackId: uuid(2),
          clipboard,
          newClipId: clipId,
        },
        context,
      );
    }

    expect(manifest.durationTicks).toBe(1_440);
    expect(manifest.tracks[0]?.clips).toHaveLength(3);
  });

  it("extends the timeline when a clip is moved right to leave silence", () => {
    const source = parseWorkspaceManifestV2({
      ...fixture(),
      durationTicks: 960,
    });
    const clipboard = copyArrangementClip(source, uuid(2), uuid(3));
    const adjacent = applyArrangementCommand(
      source,
      {
        type: "pasteClip",
        targetTrackId: uuid(2),
        clipboard,
        newClipId: uuid(13),
      },
      context,
    );
    const moved = applyArrangementCommand(
      adjacent,
      {
        type: "moveClip",
        trackId: uuid(2),
        clipId: uuid(13),
        startTick: 1_440,
      },
      context,
    );

    expect(moved.durationTicks).toBe(1_920);
    expect(moved.tracks[0]?.clips[1]).toMatchObject({ startTick: 1_440 });
  });

  it("moves and copies MIDI clips across tracks while retaining immutable lineage", () => {
    const clipboard = copyArrangementClip(fixture(), uuid(2), uuid(3));
    if (clipboard.kind !== "midi") throw new Error("Expected MIDI clipboard");
    let manifest = applyArrangementCommand(
      fixture(),
      {
        type: "materializeMidiTrack",
        trackId: uuid(10),
        name: "Bass synth",
        clipboard: { ...clipboard, presetId: "mono-bass-v1" },
        newClipId: uuid(11),
        startTick: 960,
      },
      context,
    );
    manifest = applyArrangementCommand(
      manifest,
      {
        type: "copyClipToTrack",
        sourceTrackId: uuid(2),
        targetTrackId: uuid(10),
        clipId: uuid(3),
        newClipId: uuid(12),
        startTick: 0,
      },
      context,
    );
    manifest = applyArrangementCommand(
      manifest,
      {
        type: "moveClipToTrack",
        sourceTrackId: uuid(10),
        targetTrackId: uuid(2),
        clipId: uuid(11),
        startTick: 1_440,
      },
      context,
    );

    const keys = manifest.tracks.find(({ trackId }) => trackId === uuid(2));
    const bass = manifest.tracks.find(({ trackId }) => trackId === uuid(10));
    expect(keys?.clips).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ clipId: uuid(11), startTick: 1_440 }),
      ]),
    );
    expect(bass).toMatchObject({ presetId: "mono-bass-v1" });
    expect(bass?.clips).toEqual([
      expect.objectContaining({
        clipId: uuid(12),
        startTick: 0,
        midiStemVersionId: midiVersionId,
      }),
    ]);
  });

  it("rejects overlap, source-bound, and project-bound changes", () => {
    const source = fixture();
    const manifest = applyArrangementCommand(
      source,
      {
        type: "pasteClip",
        targetTrackId: uuid(2),
        clipboard: copyArrangementClip(source, uuid(2), uuid(3)),
        newClipId: uuid(6),
      },
      context,
    );
    expect(() =>
      applyArrangementCommand(
        manifest,
        { type: "moveClip", trackId: uuid(2), clipId: uuid(6), startTick: 240 },
        context,
      ),
    ).toThrow(/cannot overlap/);
    expect(() =>
      applyArrangementCommand(
        fixture(),
        {
          type: "moveClip",
          trackId: uuid(2),
          clipId: uuid(3),
          startTick: 34_560_000,
        },
        context,
      ),
    ).toThrow(/ten-minute duration/);
  });

  it("trims and loops MIDI only within the immutable version bounds", () => {
    let manifest = applyArrangementCommand(
      fixture(),
      {
        type: "patchClip",
        trackId: uuid(2),
        clipId: uuid(3),
        patch: { sourceStartTick: 240, durationTicks: 720, loop: false },
      },
      context,
    );
    expect(manifest.tracks[0]?.clips[0]).toMatchObject({
      sourceStartTick: 240,
      durationTicks: 720,
    });
    expect(() =>
      applyArrangementCommand(
        manifest,
        {
          type: "patchClip",
          trackId: uuid(2),
          clipId: uuid(3),
          patch: { durationTicks: 721 },
        },
        context,
      ),
    ).toThrow(/Enable loop/);
    manifest = applyArrangementCommand(
      manifest,
      {
        type: "patchClip",
        trackId: uuid(2),
        clipId: uuid(3),
        patch: { loop: true, durationTicks: 1_440 },
      },
      context,
    );
    expect(manifest.tracks[0]?.clips[0]).toMatchObject({
      loop: true,
      durationTicks: 1_440,
    });
  });

  it("snaps to the selected musical grid and preserves the no-snap path", () => {
    expect(snapArrangementTick(181, 120)).toBe(240);
    expect(snapArrangementTick(181, null)).toBe(181);
  });
});
