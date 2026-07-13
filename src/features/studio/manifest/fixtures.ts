import { parseWorkspaceManifest } from "./schema";

export const STUDIO_FIXTURE_MANIFEST = parseWorkspaceManifest({
  manifestVersion: 1,
  engine: "waveform-playlist",
  engineVersion: "browser-15.3.4_playout-12.5.4_tone-15.1.22",
  workspaceId: "workspace-spike-001",
  tempoBpm: 120,
  tracks: [
    {
      trackId: "track-pulse",
      assetId: "asset-pulse-a",
      name: "Pulse A",
      positionMs: 0,
      trimStartMs: 0,
      durationMs: 2000,
      gainDb: -3,
      pan: -0.25,
      muted: false,
      soloed: false,
      sortOrder: 0,
    },
    {
      trackId: "track-chime",
      assetId: "asset-chime-b",
      name: "Chime B",
      positionMs: 500,
      trimStartMs: 0,
      durationMs: 1500,
      gainDb: -6,
      pan: 0.25,
      muted: false,
      soloed: false,
      sortOrder: 1,
    },
  ],
});

export const STUDIO_FIXTURE_ASSETS = [
  { assetId: "asset-pulse-a", url: "/fixtures/audio/stem-a.wav" },
  { assetId: "asset-chime-b", url: "/fixtures/audio/stem-b.wav" },
  { assetId: "asset-pulse-copy", url: "/fixtures/audio/stem-a.wav" },
] as const;
