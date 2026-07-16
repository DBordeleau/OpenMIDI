import type { MidiPatternVersionV3 } from "@/features/midi/domain-v3";
import {
  MIDI_V3_MAX_RESOLVED_NOTES,
  MIDI_V3_PPQ,
} from "@/features/midi/domain-v3";
import type { ArrangementManifestV3 } from "@/features/studio/manifest/v3";

export type PublicMidiEvent = {
  eventId: string;
  trackId: string;
  clipId: string;
  midiPatternVersionId: string;
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

const ticksToSeconds = (ticks: number, tempoBpm: number) =>
  (ticks * 60) / (tempoBpm * MIDI_V3_PPQ);

export function schedulePublicMidiRevision(
  manifest: ArrangementManifestV3,
  patternVersions: ReadonlyMap<string, MidiPatternVersionV3>,
): PublicMidiEvent[] {
  const events: PublicMidiEvent[] = [];
  const hasSolo = manifest.tracks.some((track) => track.soloed && !track.muted);
  for (const track of manifest.tracks) {
    if (track.muted || (hasSolo && !track.soloed)) continue;
    for (const clip of track.clips) {
      const pattern = patternVersions.get(clip.midiPatternVersionId);
      if (!pattern) {
        throw new Error(
          `Missing MIDI pattern version ${clip.midiPatternVersionId}`,
        );
      }
      const sourceSpan = pattern.durationTicks - clip.sourceStartTick;
      if (sourceSpan <= 0)
        throw new Error("MIDI clip starts beyond its pattern");
      const repetitions = clip.loop
        ? Math.ceil(clip.durationTicks / sourceSpan)
        : 1;
      for (let repetition = 0; repetition < repetitions; repetition += 1) {
        const projectBase = clip.startTick + repetition * sourceSpan;
        const clipEnd = clip.startTick + clip.durationTicks;
        for (const note of pattern.notes) {
          if (note.startTick < clip.sourceStartTick) continue;
          const startTick = projectBase + note.startTick - clip.sourceStartTick;
          const endTick = Math.min(
            startTick + note.durationTicks,
            clipEnd,
            manifest.durationTicks,
          );
          if (startTick >= clipEnd || endTick <= startTick) continue;
          events.push({
            eventId: `${clip.clipId}:${repetition}:${note.noteId}`,
            trackId: track.trackId,
            clipId: clip.clipId,
            midiPatternVersionId: pattern.midiPatternVersionId,
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
          if (events.length > MIDI_V3_MAX_RESOLVED_NOTES) {
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

export function publicMidiDurationMs(manifest: ArrangementManifestV3) {
  return Math.ceil(
    (manifest.durationTicks * 60_000) / (manifest.tempoBpm * MIDI_V3_PPQ),
  );
}
