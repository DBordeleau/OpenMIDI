import { parseWorkspaceManifest } from "./schema";

export const STUDIO_FIXTURE_MANIFEST = parseWorkspaceManifest({
  manifestVersion: 1,
  engine: "waveform-playlist",
  engineVersion: "browser-15.3.4_playout-12.5.4_tone-15.1.22",
  workspaceId: "00000000-0000-4000-8000-000000000001",
  tempoBpm: 120,
  tracks: [
    {
      trackId: "00000000-0000-4000-8000-000000000011",
      assetId: "00000000-0000-4000-8000-000000000021",
      instrumentId: null,
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
      trackId: "00000000-0000-4000-8000-000000000012",
      assetId: "00000000-0000-4000-8000-000000000022",
      instrumentId: "00000000-0000-4000-8000-000000000031",
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
  {
    assetId: "00000000-0000-4000-8000-000000000021",
    url: "/fixtures/audio/stem-a.wav",
  },
  {
    assetId: "00000000-0000-4000-8000-000000000022",
    url: "/fixtures/audio/stem-b.wav",
  },
  {
    assetId: "00000000-0000-4000-8000-000000000023",
    url: "/fixtures/audio/stem-a.wav",
  },
] as const;
