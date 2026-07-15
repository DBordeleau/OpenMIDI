import { describe, expect, it } from "vitest";
import {
  parseWorkspaceManifestV2,
  type WorkspaceManifestV2,
} from "../manifest/v2";
import {
  applyArrangementCommand,
  ArrangementCommandError,
  copyArrangementClip,
  snapArrangementTick,
} from "./commands";

const uuid = (suffix: number) =>
  `00000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`;

const midiVersionId = uuid(20);
const audioAssetId = uuid(30);
const context = {
  midiVersionDurations: new Map([[midiVersionId, 960]]),
  audioAssetDurations: new Map([[audioAssetId, 4_000]]),
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
        kind: "audio",
        trackId: uuid(4),
        assetId: audioAssetId,
        name: "Guitar",
        instrumentId: null,
        gainDb: -3,
        pan: 0,
        muted: false,
        soloed: false,
        sortOrder: 1,
        clips: [
          {
            clipId: uuid(5),
            positionMs: 0,
            trimStartMs: 0,
            durationMs: 1_000,
          },
        ],
      },
    ],
  });
}

describe("arrangement commands", () => {
  it("reorders tracks and moves MIDI and audio clips on the canonical timeline", () => {
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
    expect(manifest.tracks[0]?.clips[0]).toMatchObject({ positionMs: 500 });
  });

  it("duplicates, copies, pastes, splits, and deletes with fresh stable IDs", () => {
    let manifest = fixture();
    manifest = applyArrangementCommand(
      manifest,
      {
        type: "duplicateClip",
        trackId: uuid(2),
        clipId: uuid(3),
        newClipId: uuid(6),
      },
      context,
    );
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
      {
        type: "splitAudioClip",
        trackId: uuid(4),
        clipId: uuid(5),
        splitOffsetMs: 400,
        newClipId: uuid(8),
      },
      context,
    );
    manifest = applyArrangementCommand(
      manifest,
      { type: "deleteMidiClip", trackId: uuid(2), clipId: uuid(6) },
      context,
    );

    const midi = manifest.tracks.find((track) => track.trackId === uuid(2))!;
    const audio = manifest.tracks.find((track) => track.trackId === uuid(4))!;
    expect(midi.clips.map(({ clipId }) => clipId)).toEqual([uuid(3), uuid(7)]);
    expect(midi.clips[1]).toMatchObject({
      startTick: 960,
      midiStemVersionId: midiVersionId,
    });
    expect(audio.clips).toEqual([
      { clipId: uuid(5), positionMs: 0, trimStartMs: 0, durationMs: 400 },
      { clipId: uuid(8), positionMs: 400, trimStartMs: 400, durationMs: 600 },
    ]);
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

  it("extends the project duration when a duplicate uses the next opening", () => {
    let manifest = parseWorkspaceManifestV2({
      ...fixture(),
      durationTicks: 960,
    });
    for (const clipId of [uuid(13), uuid(14)]) {
      manifest = applyArrangementCommand(
        manifest,
        {
          type: "duplicateClip",
          trackId: uuid(2),
          clipId: uuid(3),
          newClipId: clipId,
        },
        context,
      );
    }

    expect(manifest.durationTicks).toBe(1_440);
    expect(manifest.tracks[0]?.clips).toHaveLength(3);
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

  it("rejects overlap, source-bound, incompatible-target, and project-bound changes", () => {
    const manifest = applyArrangementCommand(
      fixture(),
      {
        type: "duplicateClip",
        trackId: uuid(2),
        clipId: uuid(3),
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
          type: "patchClip",
          trackId: uuid(4),
          clipId: uuid(5),
          patch: { trimStartMs: 3_500, durationMs: 1_000 },
        },
        context,
      ),
    ).toThrow(/immutable source/);
    const clipboard = copyArrangementClip(manifest, uuid(2), uuid(3));
    expect(() =>
      applyArrangementCommand(
        manifest,
        {
          type: "pasteClip",
          targetTrackId: uuid(4),
          clipboard,
          newClipId: uuid(9),
        },
        context,
      ),
    ).toThrow(ArrangementCommandError);
    expect(() =>
      applyArrangementCommand(
        fixture(),
        {
          type: "moveClip",
          trackId: uuid(2),
          clipId: uuid(3),
          startTick: 4_560,
        },
        context,
      ),
    ).toThrow(/project duration/);
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
