import type { MidiPatternVersionV3 } from "@/features/midi/domain-v3";
import type { MidiStemVersion } from "@/features/midi/stems/types";
import {
  type ManifestV3,
  parseWorkspaceManifestV3,
  type WorkspaceManifestV3,
} from "../manifest/v3";
import {
  parseWorkspaceManifestV2,
  type WorkspaceManifestV2,
} from "../manifest/v2";

export type StudioPatternVersion = MidiPatternVersionV3 & {
  name: string;
  presetId: string;
  presetVersion: number;
};

export function toEditorManifest(manifest: ManifestV3): WorkspaceManifestV2 {
  return parseWorkspaceManifestV2({
    manifestVersion: 2,
    engine: "jam-session-composite",
    engineVersion: "jam-session-composite-2_tone-15.1.22",
    projectId: manifest.projectId,
    tempoBpm: manifest.tempoBpm,
    timeSignature: manifest.timeSignature,
    durationTicks: manifest.durationTicks,
    tracks: manifest.tracks.map((track) => ({
      kind: "midi" as const,
      trackId: track.trackId,
      name: track.name,
      instrumentId: null,
      presetId: track.presetId,
      presetVersion: track.presetVersion,
      gainDb: track.gainDb,
      pan: track.pan,
      muted: track.muted,
      soloed: track.soloed,
      sortOrder: track.sortOrder,
      clips: track.clips.map((clip) => ({
        clipId: clip.clipId,
        midiStemVersionId: clip.midiPatternVersionId,
        startTick: clip.startTick,
        durationTicks: clip.durationTicks,
        sourceStartTick: clip.sourceStartTick,
        loop: clip.loop,
      })),
    })),
  });
}

export function toWorkspaceManifestV3(
  manifest: WorkspaceManifestV2,
  authority: Pick<ManifestV3, "musicalKey" | "workspaceId">,
): WorkspaceManifestV3 {
  return parseWorkspaceManifestV3({
    manifestVersion: 3,
    engine: "jam-session-midi",
    engineVersion: "jam-session-midi-3_tone-15.1.22_presets-1",
    projectId: manifest.projectId,
    workspaceId: authority.workspaceId,
    tempoBpm: manifest.tempoBpm,
    timeSignature: manifest.timeSignature,
    musicalKey: authority.musicalKey,
    ppq: 480,
    durationTicks: manifest.durationTicks,
    tracks: manifest.tracks.map((track) => {
      if (track.kind !== "midi") {
        throw new Error("Manifest v3 cannot contain audio tracks");
      }
      return {
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
      };
    }),
  });
}

export function toEditorPatternVersion(
  pattern: StudioPatternVersion,
): MidiStemVersion {
  return {
    stemVersionId: pattern.midiPatternVersionId,
    stemId: pattern.midiPatternId,
    version: pattern.version,
    name: pattern.name,
    noteCount: pattern.noteCount,
    durationTicks: pattern.durationTicks,
    defaultPresetId: pattern.presetId,
    defaultPresetVersion: pattern.presetVersion,
    parentStemVersionId: pattern.parentMidiPatternVersionId,
    creatorCreditName: pattern.creatorCreditName,
    creatorId: pattern.creatorId,
    ppq: pattern.ppq,
    notes: pattern.notes,
    contentSha256: pattern.contentSha256,
    createdAt: pattern.createdAt,
  };
}
