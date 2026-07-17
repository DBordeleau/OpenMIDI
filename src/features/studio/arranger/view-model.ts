import type { MidiStemVersion } from "@/features/midi/stems/types";
import {
  MAX_RESOLVED_MIDI_NOTES_PER_PROJECT,
  type MidiClipReferenceV1,
  type WorkspaceManifestV2,
} from "../manifest/v2";
import { ticksToMilliseconds } from "./timeline";

export type ArrangerNoteSummary = {
  noteId: string;
  pitch: number;
  startTick: number;
  durationTicks: number;
  velocity: number;
};

export type ArrangerClip = {
  clipId: string;
  trackId: string;
  kind: "midi";
  startTick: number;
  durationTicks: number;
  startMs: number;
  durationMs: number;
  sourceStartTick: number | null;
  loop: boolean;
  versionId: string;
  versionNumber: number | null;
  creditName: string;
  notes: ArrangerNoteSummary[];
};

export type ArrangerTrack = {
  trackId: string;
  kind: "midi";
  name: string;
  instrument: string;
  creditName: string;
  gainDb: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  sortOrder: number;
  clips: ArrangerClip[];
};

export function buildArrangerViewModel(input: {
  manifest: WorkspaceManifestV2;
  midiVersions: readonly MidiStemVersion[];
  trackCredits: readonly {
    trackId: string;
    instrumentName: string | null;
    creditName: string;
  }[];
}) {
  const versions = new Map(
    input.midiVersions.map((version) => [version.stemVersionId, version]),
  );
  const credits = new Map(
    input.trackCredits.map((track) => [track.trackId, track]),
  );
  const tracks: ArrangerTrack[] = input.manifest.tracks.map((track) => {
    const credit = credits.get(track.trackId);
    const clips: ArrangerClip[] = track.clips.map((clip) => {
      const version = versions.get(clip.midiStemVersionId);
      return {
        clipId: clip.clipId,
        trackId: track.trackId,
        kind: "midi",
        startTick: clip.startTick,
        durationTicks: clip.durationTicks,
        startMs: ticksToMilliseconds(clip.startTick, input.manifest.tempoBpm),
        durationMs: ticksToMilliseconds(
          clip.durationTicks,
          input.manifest.tempoBpm,
        ),
        sourceStartTick: clip.sourceStartTick,
        loop: clip.loop,
        versionId: clip.midiStemVersionId,
        versionNumber: version?.version ?? null,
        creditName:
          version?.creatorCreditName ?? credit?.creditName ?? "Unknown creator",
        notes: version ? summarizeMidiClip(clip, version) : [],
      };
    });
    return {
      trackId: track.trackId,
      kind: track.kind,
      name: track.name,
      instrument: `${track.presetId} v${track.presetVersion}`,
      creditName:
        credit?.creditName ?? clips[0]?.creditName ?? "Unknown creator",
      gainDb: track.gainDb,
      pan: track.pan,
      muted: track.muted,
      soloed: track.soloed,
      sortOrder: track.sortOrder,
      clips,
    };
  });
  return { ...input.manifest, tracks };
}

function summarizeMidiClip(
  clip: MidiClipReferenceV1,
  version: MidiStemVersion,
) {
  const sourceSpan = version.durationTicks - clip.sourceStartTick;
  if (sourceSpan <= 0) return [];
  const repetitions = clip.loop
    ? Math.ceil(clip.durationTicks / sourceSpan)
    : 1;
  const clipEnd = clip.startTick + clip.durationTicks;
  const notes: ArrangerNoteSummary[] = [];
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    const projectBase = clip.startTick + repetition * sourceSpan;
    for (const note of version.notes) {
      if (note.startTick < clip.sourceStartTick) continue;
      const startTick = projectBase + note.startTick - clip.sourceStartTick;
      const endTick = Math.min(startTick + note.durationTicks, clipEnd);
      if (startTick >= clipEnd || endTick <= startTick) continue;
      notes.push({
        noteId: `${repetition}:${note.noteId}`,
        pitch: note.pitch,
        velocity: note.velocity,
        startTick,
        durationTicks: endTick - startTick,
      });
      if (notes.length >= MAX_RESOLVED_MIDI_NOTES_PER_PROJECT) return notes;
    }
  }
  return notes;
}
