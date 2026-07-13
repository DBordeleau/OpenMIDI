import { z } from "zod";

export const STUDIO_ENGINE_VERSION =
  "browser-15.3.4_playout-12.5.4_tone-15.1.22";

const trackSchema = z
  .object({
    trackId: z.string().min(1).max(100),
    assetId: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(120),
    positionMs: z.number().int().nonnegative(),
    trimStartMs: z.number().int().nonnegative(),
    durationMs: z.number().int().positive(),
    gainDb: z.number().finite().min(-60).max(6),
    pan: z.number().finite().min(-1).max(1),
    muted: z.boolean(),
    soloed: z.boolean(),
    sortOrder: z.number().int().nonnegative(),
  })
  .strict();

export const workspaceManifestV1Schema = z
  .object({
    manifestVersion: z.literal(1),
    engine: z.literal("waveform-playlist"),
    engineVersion: z.literal(STUDIO_ENGINE_VERSION),
    workspaceId: z.string().min(1).max(100),
    tempoBpm: z.number().finite().min(20).max(400),
    tracks: z.array(trackSchema).min(1).max(12),
  })
  .strict()
  .superRefine(({ tracks }, context) => {
    for (const key of ["trackId", "assetId", "sortOrder"] as const) {
      const seen = new Set<string | number>();
      for (const [index, track] of tracks.entries()) {
        if (seen.has(track[key])) {
          context.addIssue({
            code: "custom",
            message: `Duplicate ${key}`,
            path: ["tracks", index, key],
          });
        }
        seen.add(track[key]);
      }
    }
  });

export type WorkspaceManifestV1 = z.infer<typeof workspaceManifestV1Schema>;
export type WorkspaceTrackV1 = WorkspaceManifestV1["tracks"][number];

export function parseWorkspaceManifest(input: unknown): WorkspaceManifestV1 {
  const parsed = workspaceManifestV1Schema.parse(input);
  return canonicalizeManifest(parsed);
}

export function canonicalizeManifest(
  manifest: WorkspaceManifestV1,
): WorkspaceManifestV1 {
  return {
    ...manifest,
    tracks: [...manifest.tracks].sort(
      (left, right) => left.sortOrder - right.sortOrder,
    ),
  };
}

// Future versions register a schema and an explicit migration here. Never cast old JSON to v1.
export function parseVersionedWorkspaceManifest(
  input: unknown,
): WorkspaceManifestV1 {
  return parseWorkspaceManifest(input);
}
