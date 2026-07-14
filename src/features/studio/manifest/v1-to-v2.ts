import type { WorkspaceManifestV1 } from "./schema";
import {
  COMPOSITE_STUDIO_ENGINE_VERSION,
  MIDI_PPQ,
  parseWorkspaceManifestV2,
  type WorkspaceManifestV2,
} from "./v2";

export function mapManifestV1ToV2(
  manifest: WorkspaceManifestV1,
): WorkspaceManifestV2 {
  const tracks = manifest.tracks.map((track) => ({
    kind: "audio" as const,
    trackId: track.trackId,
    assetId: track.assetId,
    name: track.name,
    instrumentId: track.instrumentId,
    gainDb: track.gainDb,
    pan: track.pan,
    muted: track.muted,
    soloed: track.soloed,
    sortOrder: track.sortOrder,
    clips: [
      {
        // V1 has exactly one region per track, so reusing its stable track ID
        // produces a deterministic, globally unique initial clip identity.
        clipId: track.trackId,
        positionMs: track.positionMs,
        trimStartMs: track.trimStartMs,
        durationMs: track.durationMs,
      },
    ],
  }));
  const durationMs = Math.max(
    ...manifest.tracks.map(
      ({ positionMs, durationMs }) => positionMs + durationMs,
    ),
  );
  const durationTicks = Math.max(
    1,
    Math.ceil((durationMs * manifest.tempoBpm * MIDI_PPQ) / 60_000),
  );

  return parseWorkspaceManifestV2({
    manifestVersion: 2,
    engine: "jam-session-composite",
    engineVersion: COMPOSITE_STUDIO_ENGINE_VERSION,
    // V1's workspaceId is historically a project ID, not a mutable workspace row ID.
    projectId: manifest.workspaceId,
    tempoBpm: manifest.tempoBpm,
    timeSignature: { numerator: 4, denominator: 4 },
    durationTicks,
    tracks,
  });
}
