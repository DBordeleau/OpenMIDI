import type { AudioQuickPreviewResponse } from "../preview-contract";

export type PreviewScheduleItem = {
  trackIndex: number;
  delaySeconds: number;
  offsetSeconds: number;
  durationSeconds: number;
  gain: number;
  pan: number;
};

export function buildPreviewSchedule(
  tracks: AudioQuickPreviewResponse["tracks"],
  playheadMs: number,
): PreviewScheduleItem[] {
  const hasSolo = tracks.some((track) => track.soloed);
  return tracks.flatMap((track, trackIndex) => {
    if (track.muted || (hasSolo && !track.soloed)) return [];
    const elapsedInTrackMs = Math.max(0, playheadMs - track.positionMs);
    const remainingMs = track.durationMs - elapsedInTrackMs;
    if (remainingMs <= 0) return [];
    return [
      {
        trackIndex,
        delaySeconds: Math.max(0, track.positionMs - playheadMs) / 1_000,
        offsetSeconds: (track.trimStartMs + elapsedInTrackMs) / 1_000,
        durationSeconds: remainingMs / 1_000,
        gain: Math.pow(10, track.gainDb / 20),
        pan: track.pan,
      },
    ];
  });
}
