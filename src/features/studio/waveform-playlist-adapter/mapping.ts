import type { ClipTrack } from "@waveform-playlist/core";
import type { WorkspaceManifestV1, WorkspaceTrackV1 } from "../manifest/schema";

export const millisecondsToSamples = (
  milliseconds: number,
  sampleRate: number,
) => Math.round((milliseconds / 1000) * sampleRate);
export const samplesToMilliseconds = (samples: number, sampleRate: number) =>
  Math.round((samples / sampleRate) * 1000);
export const decibelsToGain = (decibels: number) => Math.pow(10, decibels / 20);
export const gainToDecibels = (gain: number) => 20 * Math.log10(gain);

export function manifestTrackToClipTrack(
  track: WorkspaceTrackV1,
  audioBuffer?: AudioBuffer,
): ClipTrack {
  const sampleRate = audioBuffer?.sampleRate ?? 48_000;
  const sourceDurationSamples =
    audioBuffer?.length ??
    millisecondsToSamples(track.trimStartMs + track.durationMs, sampleRate);
  return {
    id: track.trackId,
    name: track.name,
    muted: track.muted,
    soloed: track.soloed,
    volume: decibelsToGain(track.gainDb),
    pan: track.pan,
    clips: [
      {
        id: `${track.trackId}:${track.assetId}`,
        ...(audioBuffer ? { audioBuffer } : {}),
        startSample: millisecondsToSamples(track.positionMs, sampleRate),
        durationSamples: millisecondsToSamples(track.durationMs, sampleRate),
        offsetSamples: millisecondsToSamples(track.trimStartMs, sampleRate),
        sourceDurationSamples,
        sampleRate,
        gain: 1,
        name: track.name,
      },
    ],
  };
}

export function editorTracksToManifest(
  base: WorkspaceManifestV1,
  tracks: readonly ClipTrack[],
): WorkspaceManifestV1 {
  return {
    ...base,
    tracks: tracks.map((track, sortOrder) => {
      const persisted = base.tracks.find(({ trackId }) => trackId === track.id);
      const clip = track.clips[0];
      if (!persisted || !clip)
        throw new Error(`Unknown editor track ${track.id}`);
      return {
        ...persisted,
        name: track.name,
        positionMs: samplesToMilliseconds(clip.startSample, clip.sampleRate),
        trimStartMs: samplesToMilliseconds(clip.offsetSamples, clip.sampleRate),
        durationMs: samplesToMilliseconds(
          clip.durationSamples,
          clip.sampleRate,
        ),
        gainDb: Number(gainToDecibels(track.volume).toFixed(3)),
        pan: track.pan,
        muted: track.muted,
        soloed: track.soloed,
        sortOrder,
      };
    }),
  };
}
