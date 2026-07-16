import type { MusicalKey } from "@/features/projects/types";
import {
  MIDI_V3_ENGINE_ID,
  MIDI_V3_ENGINE_VERSION,
  MIDI_V3_PPQ,
} from "@/features/midi/domain-v3";
import { parseWorkspaceManifestV2, type WorkspaceManifestV2 } from "./v2";
import { parseManifestV3, type ManifestV3 } from "./v3";

export function convertMidiOnlyManifestV2ToV3(
  input: WorkspaceManifestV2,
  options: { workspaceId?: string; musicalKey?: MusicalKey | null } = {},
): ManifestV3 {
  const manifest = parseWorkspaceManifestV2(input);
  return parseManifestV3({
    manifestVersion: 3,
    engine: MIDI_V3_ENGINE_ID,
    engineVersion: MIDI_V3_ENGINE_VERSION,
    projectId: manifest.projectId,
    ...(options.workspaceId ? { workspaceId: options.workspaceId } : {}),
    tempoBpm: manifest.tempoBpm,
    timeSignature: manifest.timeSignature,
    musicalKey: options.musicalKey ?? null,
    ppq: MIDI_V3_PPQ,
    durationTicks: manifest.durationTicks,
    tracks: manifest.tracks.map((track) => ({
      trackId: track.trackId,
      sortOrder: track.sortOrder,
      name: track.name,
      presetId: track.presetId,
      presetVersion: track.presetVersion,
      gainDb: track.gainDb,
      pan: track.pan,
      muted: track.muted,
      soloed: track.soloed,
      clips: track.clips.map((clip) => ({
        clipId: clip.clipId,
        midiPatternVersionId: clip.midiStemVersionId,
        startTick: clip.startTick,
        durationTicks: clip.durationTicks,
        sourceStartTick: clip.sourceStartTick,
        loop: clip.loop,
      })),
    })),
  });
}
