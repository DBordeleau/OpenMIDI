import {
  MIDI_PPQ,
  MAX_RESOLVED_MIDI_NOTES_PER_PROJECT,
  type MidiStemVersionV1,
  type MidiTrackV2,
  type WorkspaceManifestV2,
} from "@/features/studio/manifest/v2";

export type MidiEngineEvent = {
  eventId: string;
  trackId: string;
  clipId: string;
  stemVersionId: string;
  presetId: string;
  presetVersion: number;
  pitch: number;
  velocity: number;
  startTick: number;
  endTick: number;
  startSeconds: number;
  durationSeconds: number;
  gainDb: number;
  pan: number;
};

export type ProjectMidiScheduleInput = {
  manifest: WorkspaceManifestV2;
  stemVersions: ReadonlyMap<string, MidiStemVersionV1>;
  windowStartTick?: number;
  windowEndTick?: number;
};

function ticksToSeconds(ticks: number, tempoBpm: number) {
  return (ticks * 60) / (tempoBpm * MIDI_PPQ);
}

function activeMidiTracks(
  tracks: WorkspaceManifestV2["tracks"],
): MidiTrackV2[] {
  const midiTracks = tracks.filter(
    (track): track is MidiTrackV2 => track.kind === "midi",
  );
  const hasSolo = midiTracks.some(({ soloed, muted }) => soloed && !muted);
  return midiTracks.filter(
    (track) => !track.muted && (!hasSolo || track.soloed),
  );
}

export function projectMidiSchedule({
  manifest,
  stemVersions,
  windowStartTick = 0,
  windowEndTick = manifest.durationTicks,
}: ProjectMidiScheduleInput): MidiEngineEvent[] {
  if (
    !Number.isInteger(windowStartTick) ||
    !Number.isInteger(windowEndTick) ||
    windowStartTick < 0 ||
    windowEndTick <= windowStartTick ||
    windowEndTick > manifest.durationTicks
  ) {
    throw new RangeError("Invalid MIDI scheduling window");
  }

  const events: MidiEngineEvent[] = [];
  for (const track of activeMidiTracks(manifest.tracks)) {
    for (const clip of track.clips) {
      const stem = stemVersions.get(clip.midiStemVersionId);
      if (!stem)
        throw new Error(`Missing MIDI stem version ${clip.midiStemVersionId}`);
      if (stem.ppq !== MIDI_PPQ) throw new Error("Unsupported MIDI stem PPQ");
      if (
        track.presetId !== stem.defaultPresetId ||
        track.presetVersion !== stem.defaultPresetVersion
      ) {
        // An imported track may deliberately override the stem default, but the
        // scheduler still requires an exact immutable preset version on the track.
      }

      const sourceSpan = stem.durationTicks - clip.sourceStartTick;
      if (sourceSpan <= 0)
        throw new Error("MIDI clip starts beyond its stem version");
      const repetitions = clip.loop
        ? Math.ceil(clip.durationTicks / sourceSpan)
        : 1;
      for (let repetition = 0; repetition < repetitions; repetition += 1) {
        const sourceBase = clip.sourceStartTick;
        const projectBase = clip.startTick + repetition * sourceSpan;
        const clipEnd = clip.startTick + clip.durationTicks;
        for (const note of stem.notes) {
          if (note.startTick < sourceBase) continue;
          const projectedStart = projectBase + note.startTick - sourceBase;
          const projectedEnd = Math.min(
            projectBase + note.startTick + note.durationTicks - sourceBase,
            clipEnd,
            manifest.durationTicks,
          );
          if (
            projectedStart >= clipEnd ||
            projectedEnd <= windowStartTick ||
            projectedStart >= windowEndTick
          )
            continue;
          const startTick = Math.max(projectedStart, windowStartTick);
          const endTick = Math.min(projectedEnd, windowEndTick);
          if (endTick <= startTick) continue;
          events.push({
            eventId: `${clip.clipId}:${repetition}:${note.noteId}`,
            trackId: track.trackId,
            clipId: clip.clipId,
            stemVersionId: stem.stemVersionId,
            presetId: track.presetId,
            presetVersion: track.presetVersion,
            pitch: note.pitch,
            velocity: note.velocity,
            startTick,
            endTick,
            startSeconds: ticksToSeconds(startTick, manifest.tempoBpm),
            durationSeconds: ticksToSeconds(
              endTick - startTick,
              manifest.tempoBpm,
            ),
            gainDb: track.gainDb,
            pan: track.pan,
          });
          if (events.length > MAX_RESOLVED_MIDI_NOTES_PER_PROJECT) {
            throw new RangeError("Resolved MIDI note limit exceeded");
          }
        }
      }
    }
  }

  return events.sort(
    (left, right) =>
      left.startTick - right.startTick ||
      left.trackId.localeCompare(right.trackId) ||
      left.pitch - right.pitch ||
      left.eventId.localeCompare(right.eventId),
  );
}
