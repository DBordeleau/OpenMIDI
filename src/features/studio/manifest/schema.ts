import { z } from "zod";
import {
  canonicalizeManifestV2,
  workspaceManifestV2Schema,
  type WorkspaceManifestV2,
} from "./v2";

export const STUDIO_ENGINE_VERSION =
  "browser-15.3.4_playout-12.5.4_tone-15.1.22";

const trackSchema = z
  .object({
    trackId: z.uuid(),
    assetId: z.uuid(),
    instrumentId: z.uuid().nullable(),
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
    workspaceId: z.uuid(),
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
    const orders = tracks
      .map(({ sortOrder }) => sortOrder)
      .sort((a, b) => a - b);
    if (orders.some((order, index) => order !== index)) {
      context.addIssue({
        code: "custom",
        message: "Track sortOrder values must be contiguous",
        path: ["tracks"],
      });
    }
  });

export type WorkspaceManifestV1 = z.infer<typeof workspaceManifestV1Schema>;
export type WorkspaceTrackV1 = WorkspaceManifestV1["tracks"][number];
export type VersionedWorkspaceManifest =
  WorkspaceManifestV1 | WorkspaceManifestV2;

export function parseWorkspaceManifest(input: unknown): WorkspaceManifestV1 {
  const parsed = workspaceManifestV1Schema.parse(input);
  return canonicalizeManifest(parsed);
}

export function serializeCanonicalManifest(
  manifest: VersionedWorkspaceManifest,
): string {
  return JSON.stringify(
    manifest.manifestVersion === 1
      ? canonicalizeManifest(manifest)
      : canonicalizeManifestV2(manifest),
  );
}

// PostgreSQL jsonb text orders object keys by length and then byte value and
// includes a space after separators. Published checksums use that representation.
export function serializePostgresJsonb(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number")
    return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map(serializePostgresJsonb).join(", ")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) =>
        left.length - right.length ||
        (left < right ? -1 : left > right ? 1 : 0),
    );
    return `{${entries
      .map(
        ([key, item]) =>
          `${JSON.stringify(key)}: ${serializePostgresJsonb(item)}`,
      )
      .join(", ")}}`;
  }
  throw new TypeError("Unsupported JSON value");
}

export async function sha256PostgresJsonb(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(serializePostgresJsonb(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
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

export function parseVersionedWorkspaceManifest(
  input: unknown,
): WorkspaceManifestV1 {
  return parseWorkspaceManifest(input);
}

export function parseAnyWorkspaceManifest(
  input: unknown,
): VersionedWorkspaceManifest {
  const version = z.object({ manifestVersion: z.number() }).safeParse(input);
  if (!version.success) throw version.error;
  if (version.data.manifestVersion === 1) return parseWorkspaceManifest(input);
  if (version.data.manifestVersion === 2)
    return canonicalizeManifestV2(workspaceManifestV2Schema.parse(input));
  throw new Error("Unsupported workspace manifest version");
}
