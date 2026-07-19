import { z } from "zod";
import { midiPatternVersionV3Schema, type MidiNoteV3 } from "./domain-v3";
import {
  parseMidiPatternVersionV3,
  parseArrangementManifestV3,
  validateManifestPatternReferencesV3,
  type ArrangementManifestV3,
} from "@/features/studio/manifest/v3";

export const MIDI_SEMANTIC_DIFF_VERSION =
  "openmidi-midi-semantic-diff-1" as const;

const semanticDiffInputSchema = z
  .object({
    manifest: z.unknown(),
    patternVersions: z.array(midiPatternVersionV3Schema),
  })
  .strict();

export type SemanticDiffInputV1 = {
  manifest: ArrangementManifestV3;
  patternVersions: ReadonlyMap<
    string,
    z.infer<typeof midiPatternVersionV3Schema>
  >;
};

type ValueChange<T extends string> = {
  field: T;
  before: unknown;
  after: unknown;
};

export type TrackDiffV1 = {
  trackId: string;
  kind: "added" | "removed" | "changed";
  changes: Array<
    ValueChange<
      | "name"
      | "sortOrder"
      | "presetId"
      | "presetVersion"
      | "gainDb"
      | "pan"
      | "muted"
      | "soloed"
    >
  >;
};

export type ClipDiffV1 = {
  clipId: string;
  kind: "added" | "removed" | "changed";
  beforeTrackId: string | null;
  afterTrackId: string | null;
  changes: Array<
    ValueChange<
      | "trackId"
      | "startTick"
      | "durationTicks"
      | "sourceStartTick"
      | "loop"
      | "midiPatternVersionId"
    >
  >;
};

export type NoteDiffV1 = {
  clipId: string;
  noteId: string;
  kind: "added" | "removed" | "changed";
  changes: Array<
    ValueChange<"startTick" | "durationTicks" | "pitch" | "velocity">
  >;
};

export type LineageDiffV1 = {
  clipId: string;
  beforeMidiPatternVersionId: string;
  afterMidiPatternVersionId: string;
  changes: Array<
    ValueChange<
      | "midiPatternId"
      | "parentMidiPatternVersionId"
      | "sourceMidiPatternVersionId"
    >
  >;
};

export type MidiSemanticDiffV1 = {
  algorithmVersion: typeof MIDI_SEMANTIC_DIFF_VERSION;
  unchanged: boolean;
  metadata: Array<
    ValueChange<"tempoBpm" | "timeSignature" | "musicalKey" | "durationTicks">
  >;
  tracks: TrackDiffV1[];
  clips: ClipDiffV1[];
  notes: NoteDiffV1[];
  lineage: LineageDiffV1[];
};

function isEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function collectChanges<T extends string>(
  fields: readonly T[],
  before: Record<T, unknown>,
  after: Record<T, unknown>,
): Array<ValueChange<T>> {
  return fields.flatMap((field) =>
    isEqual(before[field], after[field])
      ? []
      : [{ field, before: before[field], after: after[field] }],
  );
}

function parseInput(input: unknown): SemanticDiffInputV1 {
  const parsed = semanticDiffInputSchema.parse(input);
  const manifest = parseArrangementManifestV3(parsed.manifest);
  const patternVersions = new Map(
    parsed.patternVersions.map((pattern) => {
      const canonical = parseMidiPatternVersionV3(pattern);
      return [canonical.midiPatternVersionId, canonical] as const;
    }),
  );
  if (patternVersions.size !== parsed.patternVersions.length) {
    throw new Error("Duplicate MIDI pattern version ID in semantic diff input");
  }
  validateManifestPatternReferencesV3(manifest, patternVersions);
  return { manifest, patternVersions };
}

function trackMap(manifest: ArrangementManifestV3) {
  return new Map(manifest.tracks.map((track) => [track.trackId, track]));
}

function clipMap(manifest: ArrangementManifestV3) {
  return new Map(
    manifest.tracks.flatMap((track) =>
      track.clips.map(
        (clip) => [clip.clipId, { ...clip, trackId: track.trackId }] as const,
      ),
    ),
  );
}

function noteMap(notes: readonly MidiNoteV3[]) {
  return new Map(notes.map((note) => [note.noteId, note]));
}

export function diffMidiArrangementsV1(
  beforeInput: unknown,
  afterInput: unknown,
): MidiSemanticDiffV1 {
  const before = parseInput(beforeInput);
  const after = parseInput(afterInput);
  const metadata = collectChanges(
    ["tempoBpm", "timeSignature", "musicalKey", "durationTicks"] as const,
    before.manifest,
    after.manifest,
  );

  const beforeTracks = trackMap(before.manifest);
  const afterTracks = trackMap(after.manifest);
  const tracks: TrackDiffV1[] = [];
  for (const trackId of [
    ...new Set([...beforeTracks.keys(), ...afterTracks.keys()]),
  ].sort()) {
    const previous = beforeTracks.get(trackId);
    const next = afterTracks.get(trackId);
    if (!previous || !next) {
      tracks.push({
        trackId,
        kind: previous ? "removed" : "added",
        changes: [],
      });
      continue;
    }
    const changes = collectChanges(
      [
        "name",
        "sortOrder",
        "presetId",
        "presetVersion",
        "gainDb",
        "pan",
        "muted",
        "soloed",
      ] as const,
      previous,
      next,
    );
    if (changes.length > 0) tracks.push({ trackId, kind: "changed", changes });
  }

  const beforeClips = clipMap(before.manifest);
  const afterClips = clipMap(after.manifest);
  const clips: ClipDiffV1[] = [];
  const notes: NoteDiffV1[] = [];
  const lineage: LineageDiffV1[] = [];
  for (const clipId of [
    ...new Set([...beforeClips.keys(), ...afterClips.keys()]),
  ].sort()) {
    const previous = beforeClips.get(clipId);
    const next = afterClips.get(clipId);
    if (!previous || !next) {
      clips.push({
        clipId,
        kind: previous ? "removed" : "added",
        beforeTrackId: previous?.trackId ?? null,
        afterTrackId: next?.trackId ?? null,
        changes: [],
      });
      continue;
    }
    const changes = collectChanges(
      [
        "trackId",
        "startTick",
        "durationTicks",
        "sourceStartTick",
        "loop",
        "midiPatternVersionId",
      ] as const,
      previous,
      next,
    );
    if (changes.length > 0) {
      clips.push({
        clipId,
        kind: "changed",
        beforeTrackId: previous.trackId,
        afterTrackId: next.trackId,
        changes,
      });
    }

    const previousPattern = before.patternVersions.get(
      previous.midiPatternVersionId,
    );
    const nextPattern = after.patternVersions.get(next.midiPatternVersionId);
    if (!previousPattern || !nextPattern) {
      throw new Error(`Missing MIDI pattern version for clip ${clipId}`);
    }
    if (previous.midiPatternVersionId === next.midiPatternVersionId) continue;

    const previousNotes = noteMap(previousPattern.notes);
    const nextNotes = noteMap(nextPattern.notes);
    for (const noteId of [
      ...new Set([...previousNotes.keys(), ...nextNotes.keys()]),
    ].sort()) {
      const previousNote = previousNotes.get(noteId);
      const nextNote = nextNotes.get(noteId);
      if (!previousNote || !nextNote) {
        notes.push({
          clipId,
          noteId,
          kind: previousNote ? "removed" : "added",
          changes: [],
        });
        continue;
      }
      const noteChanges = collectChanges(
        ["startTick", "durationTicks", "pitch", "velocity"] as const,
        previousNote,
        nextNote,
      );
      if (noteChanges.length > 0) {
        notes.push({ clipId, noteId, kind: "changed", changes: noteChanges });
      }
    }

    const lineageChanges = collectChanges(
      [
        "midiPatternId",
        "parentMidiPatternVersionId",
        "sourceMidiPatternVersionId",
      ] as const,
      previousPattern,
      nextPattern,
    );
    if (lineageChanges.length > 0) {
      lineage.push({
        clipId,
        beforeMidiPatternVersionId: previous.midiPatternVersionId,
        afterMidiPatternVersionId: next.midiPatternVersionId,
        changes: lineageChanges,
      });
    }
  }

  return {
    algorithmVersion: MIDI_SEMANTIC_DIFF_VERSION,
    unchanged:
      metadata.length +
        tracks.length +
        clips.length +
        notes.length +
        lineage.length ===
      0,
    metadata,
    tracks,
    clips,
    notes,
    lineage,
  };
}
