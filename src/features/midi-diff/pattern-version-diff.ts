import { midiPitchName } from "@/features/midi/stems/piano-roll";
import type {
  MidiLibraryHistoryVersion,
  MidiLibraryNote,
} from "@/features/midi-library/types";
import {
  MIDI_DIFF_VISUAL_STATES,
  type MidiDiffClip,
  type MidiDiffFieldDetail,
  type MidiDiffNoteGeometry,
} from "./types";

function geometry(note: MidiLibraryNote): MidiDiffNoteGeometry {
  return {
    startTick: note.startTick,
    durationTicks: note.durationTicks,
    pitch: note.pitch,
    velocity: note.velocity,
    pitchName: midiPitchName(note.pitch),
    positionLabel: `tick ${note.startTick}`,
    durationLabel: `${note.durationTicks} ticks`,
  };
}

function details(
  before: MidiLibraryNote,
  after: MidiLibraryNote,
): MidiDiffFieldDetail[] {
  return [
    ["startTick", "Start tick", before.startTick, after.startTick],
    ["durationTicks", "Duration", before.durationTicks, after.durationTicks],
    ["pitch", "Pitch", midiPitchName(before.pitch), midiPitchName(after.pitch)],
    ["velocity", "Velocity", before.velocity, after.velocity],
  ].flatMap(([field, label, left, right]) =>
    left === right
      ? []
      : [
          {
            field: String(field),
            label: String(label),
            before: String(left),
            after: String(right),
          },
        ],
  );
}

function patternSide(version: MidiLibraryHistoryVersion, trackName: string) {
  return {
    trackId: version.midiPatternId,
    trackName,
    positionLabel: "tick 0",
    durationLabel: `${version.durationTicks} ticks`,
    sourcePositionLabel: "tick 0",
    loopLabel: "No loop",
    noteCount: version.noteCount,
    pattern: {
      midiPatternVersionId: version.midiPatternVersionId,
      midiPatternId: version.midiPatternId,
      version: version.versionNumber,
      creatorCreditName: version.creatorCreditName,
      parentMidiPatternVersionId: version.parentMidiPatternVersionId,
      sourceMidiPatternVersionId: version.sourceMidiPatternVersionId,
      reuseLicenseCode: version.reuseLicenseCode,
      reuseLicenseUrl: version.reuseLicenseUrl,
    },
  };
}

export function createPatternVersionDiffClip(input: {
  before: MidiLibraryHistoryVersion;
  after: MidiLibraryHistoryVersion;
  title: string;
}): MidiDiffClip {
  if (input.before.midiPatternId !== input.after.midiPatternId) {
    throw new Error("midi_library_comparison_pattern_mismatch");
  }
  const beforeNotes = new Map(
    input.before.notes.map((note) => [note.noteId, note]),
  );
  const afterNotes = new Map(
    input.after.notes.map((note) => [note.noteId, note]),
  );
  const noteIds = [
    ...new Set([...beforeNotes.keys(), ...afterNotes.keys()]),
  ].sort();
  const noteChanges: MidiDiffClip["noteChanges"] = [];
  const noteContext: MidiDiffClip["noteContext"] = [];
  for (const noteId of noteIds) {
    const before = beforeNotes.get(noteId);
    const after = afterNotes.get(noteId);
    const beforeGeometry = before ? geometry(before) : null;
    const afterGeometry = after ? geometry(after) : null;
    noteContext.push({ noteId, before: beforeGeometry, after: afterGeometry });
    if (!before && after) {
      const visual = MIDI_DIFF_VISUAL_STATES.added;
      noteChanges.push({
        noteId,
        state: "added",
        marker: visual.marker,
        label: visual.label,
        before: null,
        after: afterGeometry,
        changedFacets: [],
        details: [],
        overlay: {
          beforeVisible: false,
          afterVisible: true,
          lineStyle: "solid",
        },
      });
    } else if (before && !after) {
      const visual = MIDI_DIFF_VISUAL_STATES.removed;
      noteChanges.push({
        noteId,
        state: "removed",
        marker: visual.marker,
        label: visual.label,
        before: beforeGeometry,
        after: null,
        changedFacets: [],
        details: [],
        overlay: {
          beforeVisible: true,
          afterVisible: false,
          lineStyle: "dashed",
        },
      });
    } else if (before && after) {
      const changed = details(before, after);
      if (changed.length) {
        const visual = MIDI_DIFF_VISUAL_STATES.changed;
        noteChanges.push({
          noteId,
          state: "changed",
          marker: visual.marker,
          label: visual.label,
          before: beforeGeometry,
          after: afterGeometry,
          changedFacets: changed.map((item) => item.field),
          details: changed,
          overlay: {
            beforeVisible: true,
            afterVisible: true,
            lineStyle: "solid",
          },
        });
      }
    }
  }
  const states = [...new Set(noteChanges.map((note) => note.state))];
  return {
    selectionId: `pattern:${input.before.midiPatternVersionId}:${input.after.midiPatternVersionId}`,
    clipId: input.before.midiPatternId,
    state: states[0] ?? "changed",
    states: states.length ? states : ["changed"],
    marker:
      states.length === 1 ? MIDI_DIFF_VISUAL_STATES[states[0]].marker : "~",
    label: input.title,
    contextLabel: input.title,
    before: patternSide(input.before, input.title),
    after: patternSide(input.after, input.title),
    details:
      input.before.durationTicks === input.after.durationTicks
        ? []
        : [
            {
              field: "durationTicks",
              label: "Pattern duration",
              before: `${input.before.durationTicks} ticks`,
              after: `${input.after.durationTicks} ticks`,
            },
          ],
    noteChanges,
    noteContext,
    lineageDetails: [],
  };
}
