import { describe, expect, it } from "vitest";
import { diffMidiArrangementsV1 } from "@/features/midi/semantic-diff-v1";
import {
  V3_DIFF_AFTER,
  V3_DIFF_BEFORE,
  V3_IDS,
  V3_MANIFEST_AFTER,
  V3_MANIFEST_BEFORE,
} from "@/features/studio/manifest/v3.fixtures";
import { parseArrangementManifestV3 } from "@/features/studio/manifest/v3";
import { MIDI_DIFF_VISUAL_STATES } from "./types";
import { createMidiDiffViewModel } from "./view-model";

function mapFixture(before = V3_DIFF_BEFORE, after = V3_DIFF_AFTER) {
  return createMidiDiffViewModel({
    semanticDiff: diffMidiArrangementsV1(before, after),
    before,
    after,
    sideLabels: { before: "Base revision", after: "Submitted version" },
  });
}

describe("MIDI diff view model", () => {
  it("maps metadata, one-sided objects, unique note counts, and combined note changes", () => {
    const model = mapFixture();

    expect(model.status).toBe("ready");
    if (model.status !== "ready") return;

    expect(model.arrangementDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Tempo",
          before: "120 BPM",
          after: "128 BPM",
        }),
        expect.objectContaining({
          label: "Time signature",
          before: "4/4",
          after: "3/4",
        }),
      ]),
    );
    expect(model.summary.uniqueNotes).toBe(3);
    expect(model.counts.added.notes).toBe(1);
    expect(model.counts.changed.notes).toBe(1);
    expect(model.counts.removed.notes).toBe(1);

    const removedTrack = model.tracks.find(
      (track) => track.trackId === V3_IDS.trackB,
    );
    const addedTrack = model.tracks.find(
      (track) => track.trackId === V3_IDS.trackC,
    );
    expect(removedTrack).toMatchObject({ state: "removed", after: null });
    expect(removedTrack?.clips[0]).toMatchObject({
      state: "removed",
      after: null,
    });
    expect(addedTrack).toMatchObject({ state: "added", before: null });
    expect(addedTrack?.clips[0]).toMatchObject({
      state: "added",
      before: null,
    });

    const changedNote = model.tracks
      .flatMap((track) => track.clips)
      .flatMap((clip) => clip.noteChanges)
      .find((note) => note.noteId === V3_IDS.noteA);
    expect(changedNote).toMatchObject({
      state: "changed",
      changedFacets: ["Position", "Duration", "Pitch", "Velocity"],
    });
    expect(
      model.tracks
        .flatMap((track) => track.clips)
        .flatMap((clip) => clip.noteChanges)
        .filter((note) => note.noteId === V3_IDS.noteA),
    ).toHaveLength(1);
    expect(changedNote?.before?.pitchName).toBe("C4");
    expect(changedNote?.after?.pitchName).toBe("C♯4");
    expect(changedNote?.overlay).toEqual({
      beforeVisible: true,
      afterVisible: true,
      lineStyle: "solid",
    });
  });

  it("keeps moved clips under their after track with explicit before and after context", () => {
    const movedManifest = parseArrangementManifestV3({
      ...V3_MANIFEST_AFTER,
      tracks: V3_MANIFEST_AFTER.tracks.map((track) =>
        track.trackId === V3_IDS.trackA
          ? { ...track, clips: [] }
          : track.trackId === V3_IDS.trackC
            ? {
                ...track,
                clips: [
                  ...track.clips,
                  V3_MANIFEST_AFTER.tracks.find(
                    (candidate) => candidate.trackId === V3_IDS.trackA,
                  )!.clips[0],
                ],
              }
            : track,
      ),
    });
    const after = { ...V3_DIFF_AFTER, manifest: movedManifest };
    const model = mapFixture(V3_DIFF_BEFORE, after);

    expect(model.status).toBe("ready");
    if (model.status !== "ready") return;
    const movedClip = model.tracks
      .find((track) => track.trackId === V3_IDS.trackC)
      ?.clips.find((clip) => clip.clipId === V3_IDS.clipA);
    expect(movedClip).toMatchObject({
      contextLabel: "Moved from Lead to Bass",
      before: { trackName: "Lead" },
      after: { trackName: "Bass" },
    });
  });

  it("returns explicit unchanged, unavailable, and inconsistent states", () => {
    const unchangedDiff = diffMidiArrangementsV1(
      V3_DIFF_BEFORE,
      V3_DIFF_BEFORE,
    );
    expect(
      createMidiDiffViewModel({
        semanticDiff: unchangedDiff,
        before: V3_DIFF_BEFORE,
        after: V3_DIFF_BEFORE,
      }),
    ).toMatchObject({ status: "unchanged" });
    expect(
      createMidiDiffViewModel({
        semanticDiff: unchangedDiff,
        before: null,
        after: V3_DIFF_BEFORE,
      }),
    ).toMatchObject({ status: "unavailable" });
    expect(
      createMidiDiffViewModel({
        semanticDiff: { ...unchangedDiff, unchanged: false },
        before: V3_DIFF_BEFORE,
        after: V3_DIFF_BEFORE,
      }),
    ).toMatchObject({ status: "inconsistent" });
  });

  it("keeps metadata-only comparisons ready with an empty navigator", () => {
    const after = {
      ...V3_DIFF_BEFORE,
      manifest: parseArrangementManifestV3({
        ...V3_MANIFEST_BEFORE,
        tempoBpm: 124,
      }),
    };
    const model = mapFixture(V3_DIFF_BEFORE, after);

    expect(model).toMatchObject({
      status: "ready",
      defaultSelectionId: null,
      tracks: [],
      arrangementDetails: [
        { label: "Tempo", before: "120 BPM", after: "124 BPM" },
      ],
    });
  });

  it("formats accidental musical keys with the shared musician-facing label", () => {
    const after = {
      ...V3_DIFF_BEFORE,
      manifest: parseArrangementManifestV3({
        ...V3_MANIFEST_BEFORE,
        musicalKey: "f-sharp-minor",
      }),
    };
    const model = mapFixture(V3_DIFF_BEFORE, after);

    expect(model.status).toBe("ready");
    if (model.status !== "ready") return;
    expect(model.arrangementDetails).toContainEqual(
      expect.objectContaining({
        label: "Musical key",
        before: "C major",
        after: "F♯ minor",
      }),
    );
  });

  it("keeps technical pattern IDs out of selected clip and lineage details", () => {
    const model = mapFixture();

    expect(model.status).toBe("ready");
    if (model.status !== "ready") return;
    const changedClip = model.tracks
      .flatMap((track) => track.clips)
      .find((clip) => clip.clipId === V3_IDS.clipA);
    expect(changedClip?.details).toContainEqual(
      expect.objectContaining({
        field: "midiPatternVersionId",
        before: "Version 1 by Loop Maker",
        after: "Version 2 by Loop Maker",
      }),
    );
    expect(JSON.stringify(changedClip?.details)).not.toContain(
      V3_IDS.patternVersion1,
    );
    expect(JSON.stringify(changedClip?.lineageDetails)).not.toContain(
      V3_IDS.patternVersion1,
    );
  });

  it("exports the landing-consistent non-color visual contract", () => {
    expect(MIDI_DIFF_VISUAL_STATES).toMatchObject({
      added: { label: "Added", marker: "+", color: "gold" },
      changed: { label: "Changed", marker: "~", color: "coral" },
      removed: {
        label: "Removed",
        marker: "−",
        color: "muted",
        lineStyle: "dashed",
      },
    });
  });
});
