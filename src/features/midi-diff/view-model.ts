import { z } from "zod";
import type { MidiPatternVersionV3 } from "@/features/midi/domain-v3";
import { resolveCatalogPreset } from "@/features/midi/presets";
import {
  MIDI_SEMANTIC_DIFF_VERSION,
  diffMidiArrangementsV1,
  type MidiSemanticDiffV1,
} from "@/features/midi/semantic-diff-v1";
import { formatMusicalKey } from "@/features/projects/musical-key";
import {
  parseArrangementManifestV3,
  parseMidiPatternVersionV3,
  validateManifestPatternReferencesV3,
  type ArrangementManifestV3,
} from "@/features/studio/manifest/v3";
import {
  MIDI_DIFF_VISUAL_STATES,
  type MidiDiffChangeState,
  type MidiDiffClip,
  type MidiDiffClipSide,
  type MidiDiffCounts,
  type MidiDiffFieldDetail,
  type MidiDiffNote,
  type MidiDiffNoteGeometry,
  type MidiDiffPatternCredit,
  type MidiDiffReadyViewModel,
  type MidiDiffTrack,
  type MidiDiffTrackSide,
  type MidiDiffViewModel,
} from "./types";

function valueChangeSchema<T extends readonly [string, ...string[]]>(
  fields: T,
) {
  return z
    .object({
      field: z.enum(fields),
      before: z.unknown(),
      after: z.unknown(),
    })
    .strict();
}

const metadataChangeSchema = valueChangeSchema([
  "tempoBpm",
  "timeSignature",
  "musicalKey",
  "durationTicks",
] as const);
const trackChangeSchema = valueChangeSchema([
  "name",
  "sortOrder",
  "presetId",
  "presetVersion",
  "gainDb",
  "pan",
  "muted",
  "soloed",
] as const);
const clipChangeSchema = valueChangeSchema([
  "trackId",
  "startTick",
  "durationTicks",
  "sourceStartTick",
  "loop",
  "midiPatternVersionId",
] as const);
const noteChangeSchema = valueChangeSchema([
  "startTick",
  "durationTicks",
  "pitch",
  "velocity",
] as const);
const lineageChangeSchema = valueChangeSchema([
  "midiPatternId",
  "parentMidiPatternVersionId",
  "sourceMidiPatternVersionId",
] as const);

const kindSchema = z.enum(["added", "removed", "changed"]);

const semanticDiffSchema = z
  .object({
    algorithmVersion: z.literal(MIDI_SEMANTIC_DIFF_VERSION),
    unchanged: z.boolean(),
    metadata: z.array(metadataChangeSchema),
    tracks: z.array(
      z
        .object({
          trackId: z.string().min(1),
          kind: kindSchema,
          changes: z.array(trackChangeSchema),
        })
        .strict(),
    ),
    clips: z.array(
      z
        .object({
          clipId: z.string().min(1),
          kind: kindSchema,
          beforeTrackId: z.string().nullable(),
          afterTrackId: z.string().nullable(),
          changes: z.array(clipChangeSchema),
        })
        .strict(),
    ),
    notes: z.array(
      z
        .object({
          clipId: z.string().min(1),
          noteId: z.string().min(1),
          kind: kindSchema,
          changes: z.array(noteChangeSchema),
        })
        .strict(),
    ),
    lineage: z.array(
      z
        .object({
          clipId: z.string().min(1),
          beforeMidiPatternVersionId: z.string().min(1),
          afterMidiPatternVersionId: z.string().min(1),
          changes: z.array(lineageChangeSchema),
        })
        .strict(),
    ),
  })
  .strict();

const arrangementInputSchema = z
  .object({
    manifest: z.unknown(),
    patternVersions: z.array(z.unknown()),
  })
  .strict();

const patternRecordSchema = z.record(z.string(), z.unknown());

export type MidiDiffArrangementInput = {
  manifest: unknown;
  patternVersions: readonly unknown[];
};

export type MidiDiffViewModelInput = {
  semanticDiff: unknown;
  before: MidiDiffArrangementInput | null;
  after: MidiDiffArrangementInput | null;
  sideLabels?: { before: string; after: string };
};

type ParsedArrangement = {
  manifest: ArrangementManifestV3;
  patternVersions: MidiPatternVersionV3[];
  patterns: Map<string, MidiPatternVersionV3>;
};

function parsePatternVersion(input: unknown) {
  const value = patternRecordSchema.parse(input);
  return parseMidiPatternVersionV3({
    midiPatternVersionId: value.midiPatternVersionId,
    midiPatternId: value.midiPatternId,
    version: value.version,
    creatorId: value.creatorId,
    creatorCreditName: value.creatorCreditName,
    parentMidiPatternVersionId: value.parentMidiPatternVersionId,
    sourceMidiPatternVersionId: value.sourceMidiPatternVersionId,
    contentSha256: value.contentSha256,
    noteCount: value.noteCount,
    ppq: value.ppq,
    durationTicks: value.durationTicks,
    reuseLicense: value.reuseLicense,
    createdAt: value.createdAt,
    notes: value.notes,
  });
}

function parseArrangement(input: MidiDiffArrangementInput): ParsedArrangement {
  const parsed = arrangementInputSchema.parse(input);
  const manifest = parseArrangementManifestV3(parsed.manifest);
  const patternVersions = parsed.patternVersions.map(parsePatternVersion);
  const patterns = new Map(
    patternVersions.map((pattern) => [pattern.midiPatternVersionId, pattern]),
  );
  if (patterns.size !== patternVersions.length) {
    throw new Error("Duplicate MIDI pattern version in comparison input");
  }
  validateManifestPatternReferencesV3(manifest, patterns);
  return { manifest, patternVersions, patterns };
}

function mapsEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function titleCase(value: string) {
  return value
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function midiPitchName(pitch: number) {
  const names = [
    "C",
    "C♯",
    "D",
    "D♯",
    "E",
    "F",
    "F♯",
    "G",
    "G♯",
    "A",
    "A♯",
    "B",
  ];
  return `${names[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}

function formatPosition(
  ticks: number,
  manifest: Pick<ArrangementManifestV3, "ppq" | "timeSignature">,
) {
  const beatTicks = (manifest.ppq * 4) / manifest.timeSignature.denominator;
  const barTicks = beatTicks * manifest.timeSignature.numerator;
  const bar = Math.floor(ticks / barTicks) + 1;
  const withinBar = ticks % barTicks;
  const beat = Math.floor(withinBar / beatTicks) + 1;
  const tick = Math.round(withinBar % beatTicks);
  return `Bar ${bar}, beat ${beat}${tick ? `, tick ${tick}` : ""}`;
}

function formatDuration(ticks: number, ppq: number) {
  const beats = ticks / ppq;
  return `${Number.isInteger(beats) ? beats : Number(beats.toFixed(2))} ${beats === 1 ? "beat" : "beats"} (${ticks} ticks)`;
}

function formatPan(value: number) {
  if (value === 0) return "Center";
  return `${Math.round(Math.abs(value) * 100)}% ${value < 0 ? "left" : "right"}`;
}

function formatPreset(presetId: string, presetVersion: number) {
  try {
    return resolveCatalogPreset(presetId, presetVersion).name;
  } catch {
    return `${titleCase(presetId)} v${presetVersion}`;
  }
}

function formatMetadataValue(
  field: string,
  value: unknown,
  manifest: ArrangementManifestV3,
) {
  if (value === null) return "Not set";
  if (field === "tempoBpm") return `${String(value)} BPM`;
  if (field === "timeSignature") {
    const signature = z
      .object({ numerator: z.number(), denominator: z.number() })
      .parse(value);
    return `${signature.numerator}/${signature.denominator}`;
  }
  if (field === "musicalKey") return formatMusicalKey(String(value));
  if (field === "durationTicks")
    return formatDuration(z.number().parse(value), manifest.ppq);
  return String(value);
}

const fieldLabels: Record<string, string> = {
  tempoBpm: "Tempo",
  timeSignature: "Time signature",
  musicalKey: "Musical key",
  durationTicks: "Duration",
  name: "Track name",
  sortOrder: "Track order",
  presetId: "Instrument",
  presetVersion: "Preset version",
  gainDb: "Gain",
  pan: "Pan",
  muted: "Mute",
  soloed: "Solo",
  trackId: "Track",
  startTick: "Position",
  sourceStartTick: "Pattern start",
  loop: "Loop",
  midiPatternVersionId: "Pattern version",
  pitch: "Pitch",
  velocity: "Velocity",
  midiPatternId: "Pattern lineage",
  parentMidiPatternVersionId: "Parent pattern version",
  sourceMidiPatternVersionId: "Source pattern version",
};

function patternCredit(pattern: MidiPatternVersionV3): MidiDiffPatternCredit {
  return {
    midiPatternVersionId: pattern.midiPatternVersionId,
    midiPatternId: pattern.midiPatternId,
    version: pattern.version,
    creatorCreditName: pattern.creatorCreditName,
    parentMidiPatternVersionId: pattern.parentMidiPatternVersionId,
    sourceMidiPatternVersionId: pattern.sourceMidiPatternVersionId,
    reuseLicenseCode: pattern.reuseLicense?.code ?? null,
    reuseLicenseUrl: pattern.reuseLicense?.url ?? null,
  };
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

function trackSide(
  track: ArrangementManifestV3["tracks"][number] | undefined,
): MidiDiffTrackSide | null {
  if (!track) return null;
  return {
    name: track.name,
    orderLabel: `Track ${track.sortOrder + 1}`,
    presetName: formatPreset(track.presetId, track.presetVersion),
    presetTechnicalName: `${track.presetId}@${track.presetVersion}`,
    gainLabel: `${track.gainDb} dB`,
    panLabel: formatPan(track.pan),
    mutedLabel: track.muted ? "Muted" : "Not muted",
    soloedLabel: track.soloed ? "Soloed" : "Not soloed",
  };
}

function clipSide(
  clip:
    | (ArrangementManifestV3["tracks"][number]["clips"][number] & {
        trackId: string;
      })
    | undefined,
  arrangement: ParsedArrangement,
): MidiDiffClipSide | null {
  if (!clip) return null;
  const track = arrangement.manifest.tracks.find(
    (candidate) => candidate.trackId === clip.trackId,
  );
  const pattern = arrangement.patterns.get(clip.midiPatternVersionId);
  if (!track || !pattern) throw new Error("Comparison clip context is missing");
  return {
    trackId: track.trackId,
    trackName: track.name,
    positionLabel: formatPosition(clip.startTick, arrangement.manifest),
    durationLabel: formatDuration(clip.durationTicks, arrangement.manifest.ppq),
    sourcePositionLabel: formatPosition(
      clip.sourceStartTick,
      arrangement.manifest,
    ),
    loopLabel: clip.loop ? "Loops" : "Plays once",
    noteCount: pattern.noteCount,
    pattern: patternCredit(pattern),
  };
}

function displayValue(
  field: string,
  value: unknown,
  manifest: ArrangementManifestV3,
  tracks: Map<string, ArrangementManifestV3["tracks"][number]>,
  patterns: Map<string, MidiPatternVersionV3>,
) {
  if (value === null || value === undefined) return "Not present";
  if (field === "trackId")
    return tracks.get(String(value))?.name ?? String(value);
  if (
    field === "midiPatternVersionId" ||
    field === "parentMidiPatternVersionId" ||
    field === "sourceMidiPatternVersionId"
  ) {
    const pattern = patterns.get(String(value));
    return pattern
      ? `Version ${pattern.version} by ${pattern.creatorCreditName}`
      : "Linked pattern version";
  }
  if (field === "midiPatternId") {
    const pattern = [...patterns.values()].find(
      (candidate) => candidate.midiPatternId === String(value),
    );
    return pattern
      ? `Pattern by ${pattern.creatorCreditName}`
      : "Linked pattern";
  }
  if (field === "startTick" || field === "sourceStartTick")
    return formatPosition(z.number().parse(value), manifest);
  if (field === "durationTicks")
    return formatDuration(z.number().parse(value), manifest.ppq);
  if (field === "pitch") {
    const pitch = z.number().parse(value);
    return `${midiPitchName(pitch)} (MIDI ${pitch})`;
  }
  if (field === "velocity") return `${String(value)} / 127`;
  if (field === "sortOrder") return `Track ${z.number().parse(value) + 1}`;
  if (field === "presetId") return titleCase(String(value));
  if (field === "gainDb") return `${String(value)} dB`;
  if (field === "pan") return formatPan(z.number().parse(value));
  if (["muted", "soloed", "loop"].includes(field)) return value ? "Yes" : "No";
  return String(value);
}

function mapDetails(
  changes: ReadonlyArray<{ field: string; before: unknown; after: unknown }>,
  before: ParsedArrangement,
  after: ParsedArrangement,
) {
  const beforeTracks = trackMap(before.manifest);
  const afterTracks = trackMap(after.manifest);
  const patterns = new Map([...before.patterns, ...after.patterns]);
  return changes.map((change): MidiDiffFieldDetail => ({
    field: change.field,
    label: fieldLabels[change.field] ?? titleCase(change.field),
    before: displayValue(
      change.field,
      change.before,
      before.manifest,
      beforeTracks,
      patterns,
    ),
    after: displayValue(
      change.field,
      change.after,
      after.manifest,
      afterTracks,
      patterns,
    ),
  }));
}

function noteGeometry(
  note: MidiPatternVersionV3["notes"][number] | undefined,
  manifest: ArrangementManifestV3,
): MidiDiffNoteGeometry | null {
  if (!note) return null;
  return {
    startTick: note.startTick,
    durationTicks: note.durationTicks,
    pitch: note.pitch,
    velocity: note.velocity,
    pitchName: midiPitchName(note.pitch),
    positionLabel: formatPosition(note.startTick, manifest),
    durationLabel: formatDuration(note.durationTicks, manifest.ppq),
  };
}

function uniqueStates(states: MidiDiffChangeState[]) {
  return [...new Set(states)].sort(
    (left, right) =>
      ["added", "changed", "removed"].indexOf(left) -
      ["added", "changed", "removed"].indexOf(right),
  );
}

function createCounts(diff: MidiSemanticDiffV1): MidiDiffCounts {
  const empty = () => ({
    total: 0,
    tracks: 0,
    clips: 0,
    notes: 0,
    arrangementFields: 0,
    lineage: 0,
  });
  const counts: MidiDiffCounts = {
    added: empty(),
    changed: empty(),
    removed: empty(),
  };
  for (const track of diff.tracks) counts[track.kind].tracks += 1;
  for (const clip of diff.clips) counts[clip.kind].clips += 1;
  for (const note of diff.notes) counts[note.kind].notes += 1;
  counts.changed.arrangementFields = diff.metadata.length;
  counts.changed.lineage = diff.lineage.length;
  for (const state of Object.keys(counts) as MidiDiffChangeState[]) {
    const item = counts[state];
    item.total =
      item.tracks +
      item.clips +
      item.notes +
      item.arrangementFields +
      item.lineage;
  }
  return counts;
}

function buildReadyModel(
  diff: MidiSemanticDiffV1,
  before: ParsedArrangement,
  after: ParsedArrangement,
  sideLabels: { before: string; after: string },
): MidiDiffReadyViewModel {
  const beforeTracks = trackMap(before.manifest);
  const afterTracks = trackMap(after.manifest);
  const beforeClips = clipMap(before.manifest);
  const afterClips = clipMap(after.manifest);
  const trackDiffs = new Map(diff.tracks.map((item) => [item.trackId, item]));
  const clipDiffs = new Map(diff.clips.map((item) => [item.clipId, item]));
  const lineageDiffs = new Map(diff.lineage.map((item) => [item.clipId, item]));
  const notesByClip = new Map<string, MidiDiffNote[]>();

  for (const noteDiff of diff.notes) {
    const previousClip = beforeClips.get(noteDiff.clipId);
    const nextClip = afterClips.get(noteDiff.clipId);
    if (!previousClip || !nextClip)
      throw new Error("Note diff references a one-sided clip");
    const previousPattern = before.patterns.get(
      previousClip.midiPatternVersionId,
    );
    const nextPattern = after.patterns.get(nextClip.midiPatternVersionId);
    if (!previousPattern || !nextPattern)
      throw new Error("Note diff pattern is missing");
    const previousNote = previousPattern.notes.find(
      (note) => note.noteId === noteDiff.noteId,
    );
    const nextNote = nextPattern.notes.find(
      (note) => note.noteId === noteDiff.noteId,
    );
    const visual = MIDI_DIFF_VISUAL_STATES[noteDiff.kind];
    const note: MidiDiffNote = {
      noteId: noteDiff.noteId,
      state: noteDiff.kind,
      marker: visual.marker,
      label: visual.label,
      before: noteGeometry(previousNote, before.manifest),
      after: noteGeometry(nextNote, after.manifest),
      changedFacets: noteDiff.changes.map(
        (change) => fieldLabels[change.field] ?? titleCase(change.field),
      ),
      details: mapDetails(noteDiff.changes, before, after),
      overlay: {
        beforeVisible: visual.beforeVisible,
        afterVisible: visual.afterVisible,
        lineStyle: visual.lineStyle,
      },
    };
    const notes = notesByClip.get(noteDiff.clipId) ?? [];
    notes.push(note);
    notesByClip.set(noteDiff.clipId, notes);
  }

  const clipDisplays = new Map<string, MidiDiffClip>();
  const clipIds = new Set([
    ...clipDiffs.keys(),
    ...notesByClip.keys(),
    ...lineageDiffs.keys(),
  ]);
  for (const clipId of clipIds) {
    const previousClip = beforeClips.get(clipId);
    const nextClip = afterClips.get(clipId);
    const item = clipDiffs.get(clipId);
    const state = item?.kind ?? "changed";
    const noteChanges = notesByClip.get(clipId) ?? [];
    const lineage = lineageDiffs.get(clipId);
    const states = uniqueStates([
      state,
      ...noteChanges.map((note) => note.state),
      ...(lineage ? (["changed"] as const) : []),
    ]);
    const previousSide = clipSide(previousClip, before);
    const nextSide = clipSide(nextClip, after);
    const visual = MIDI_DIFF_VISUAL_STATES[state];
    const location = nextSide ?? previousSide;
    if (!location) throw new Error("Comparison clip is missing on both sides");
    clipDisplays.set(clipId, {
      selectionId: `clip:${clipId}`,
      clipId,
      state,
      states,
      marker: visual.marker,
      label: `${location.trackName} clip`,
      contextLabel:
        previousSide && nextSide && previousSide.trackId !== nextSide.trackId
          ? `Moved from ${previousSide.trackName} to ${nextSide.trackName}`
          : location.positionLabel,
      before: previousSide,
      after: nextSide,
      details: item ? mapDetails(item.changes, before, after) : [],
      noteChanges,
      lineageDetails: lineage ? mapDetails(lineage.changes, before, after) : [],
    });
  }

  const trackIds = new Set([
    ...trackDiffs.keys(),
    ...[...clipDisplays.values()].map(
      (clip) => clip.after?.trackId ?? clip.before?.trackId ?? "",
    ),
  ]);
  trackIds.delete("");
  const tracks: MidiDiffTrack[] = [...trackIds]
    .map((trackId) => {
      const previousTrack = beforeTracks.get(trackId);
      const nextTrack = afterTracks.get(trackId);
      const item = trackDiffs.get(trackId);
      const clips = [...clipDisplays.values()]
        .filter(
          (clip) => (clip.after?.trackId ?? clip.before?.trackId) === trackId,
        )
        .sort((left, right) => left.label.localeCompare(right.label));
      const state = item?.kind ?? "changed";
      const states = uniqueStates([
        state,
        ...clips.flatMap((clip) => clip.states),
      ]);
      const visual = MIDI_DIFF_VISUAL_STATES[state];
      const previousSide = trackSide(previousTrack);
      const nextSide = trackSide(nextTrack);
      const label = nextSide?.name ?? previousSide?.name;
      if (!label) throw new Error("Comparison track is missing on both sides");
      return {
        selectionId: `track:${trackId}`,
        trackId,
        state,
        states,
        marker: visual.marker,
        label,
        contextLabel: `${nextSide?.orderLabel ?? previousSide?.orderLabel} · ${clips.length} affected ${clips.length === 1 ? "clip" : "clips"}`,
        before: previousSide,
        after: nextSide,
        details: item ? mapDetails(item.changes, before, after) : [],
        clips,
      } satisfies MidiDiffTrack;
    })
    .sort((left, right) => {
      const leftTrack =
        afterTracks.get(left.trackId) ?? beforeTracks.get(left.trackId);
      const rightTrack =
        afterTracks.get(right.trackId) ?? beforeTracks.get(right.trackId);
      return (leftTrack?.sortOrder ?? 0) - (rightTrack?.sortOrder ?? 0);
    });

  const credits = [...before.patternVersions, ...after.patternVersions]
    .map(patternCredit)
    .filter(
      (credit, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.midiPatternVersionId === credit.midiPatternVersionId,
        ) === index,
    )
    .sort((left, right) =>
      left.creatorCreditName.localeCompare(right.creatorCreditName),
    );
  const counts = createCounts(diff);
  const defaultSelectionId =
    tracks.flatMap((track) => track.clips)[0]?.selectionId ??
    tracks[0]?.selectionId ??
    null;

  return {
    status: "ready",
    algorithmVersion: diff.algorithmVersion,
    sideLabels,
    counts,
    summary: {
      arrangementFields: diff.metadata.length,
      tracks: diff.tracks.length,
      clips: diff.clips.length,
      uniqueNotes: new Set(
        diff.notes.map((note) => `${note.clipId}:${note.noteId}`),
      ).size,
      lineage: diff.lineage.length,
    },
    arrangementDetails: diff.metadata.map((change) => ({
      field: change.field,
      label: fieldLabels[change.field] ?? titleCase(change.field),
      before: formatMetadataValue(change.field, change.before, before.manifest),
      after: formatMetadataValue(change.field, change.after, after.manifest),
    })),
    tracks,
    credits,
    defaultSelectionId,
  };
}

export function createMidiDiffViewModel(
  input: MidiDiffViewModelInput,
): MidiDiffViewModel {
  if (!input.before || !input.after) {
    return {
      status: "unavailable",
      title: "Comparison unavailable",
      message:
        "One of the exact immutable arrangements is unavailable. Reload the review or choose another submitted version.",
    };
  }
  try {
    const diff = semanticDiffSchema.parse(input.semanticDiff);
    const before = parseArrangement(input.before);
    const after = parseArrangement(input.after);
    const expected = diffMidiArrangementsV1(
      { manifest: before.manifest, patternVersions: before.patternVersions },
      { manifest: after.manifest, patternVersions: after.patternVersions },
    );
    if (!mapsEqual(diff, expected)) {
      throw new Error(
        "Semantic diff does not match the immutable arrangements",
      );
    }
    const sideLabels = input.sideLabels ?? {
      before: "Before",
      after: "After",
    };
    const credits = [...before.patternVersions, ...after.patternVersions]
      .map(patternCredit)
      .filter(
        (credit, index, all) =>
          all.findIndex(
            (candidate) =>
              candidate.midiPatternVersionId === credit.midiPatternVersionId,
          ) === index,
      );
    if (diff.unchanged) {
      return {
        status: "unchanged",
        algorithmVersion: diff.algorithmVersion,
        sideLabels,
        credits,
      };
    }
    return buildReadyModel(diff, before, after, sideLabels);
  } catch {
    return {
      status: "inconsistent",
      title: "Comparison needs attention",
      message:
        "The immutable comparison data is inconsistent, so OpenMIDI will not guess at what changed. Reload the review; if this continues, report the contribution for investigation.",
    };
  }
}
