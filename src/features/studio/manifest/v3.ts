import { z } from "zod";
import { musicalKeys } from "@/features/projects/schema";
import {
  arrangementTrackV3Schema,
  MIDI_V3_ENGINE_ID,
  MIDI_V3_ENGINE_VERSION,
  MIDI_V3_MAX_DURATION_TICKS,
  MIDI_V3_MAX_PROJECT_MINUTES,
  MIDI_V3_MAX_RESOLVED_NOTES,
  MIDI_V3_MAX_TEMPO_BPM,
  MIDI_V3_MAX_TRACKS,
  MIDI_V3_PPQ,
  midiPatternVersionV3Schema,
  type MidiNoteV3,
  type MidiPatternVersionV3,
  type PatternContentV3,
  type WorkspaceClipV3,
  type WorkspaceTrackV3,
} from "@/features/midi/domain-v3";
import { sha256PostgresJsonb } from "./canonical-json";

const manifestHeaderSchema = z
  .object({
    manifestVersion: z.literal(3),
    engine: z.literal(MIDI_V3_ENGINE_ID),
    engineVersion: z.literal(MIDI_V3_ENGINE_VERSION),
    projectId: z.uuid(),
    workspaceId: z.uuid().optional(),
    tempoBpm: z.number().finite().min(20).max(MIDI_V3_MAX_TEMPO_BPM),
    timeSignature: z
      .object({
        numerator: z.number().int().min(1).max(32),
        denominator: z.union([
          z.literal(1),
          z.literal(2),
          z.literal(4),
          z.literal(8),
          z.literal(16),
          z.literal(32),
        ]),
      })
      .strict(),
    musicalKey: z.enum(musicalKeys).nullable(),
    ppq: z.literal(MIDI_V3_PPQ),
    durationTicks: z.number().int().positive().max(MIDI_V3_MAX_DURATION_TICKS),
  })
  .strict();

export const manifestV3Schema = manifestHeaderSchema
  .safeExtend({
    tracks: z.array(arrangementTrackV3Schema).max(MIDI_V3_MAX_TRACKS),
  })
  .superRefine(({ durationTicks, tempoBpm, tracks }, context) => {
    const maximumDurationTicks = Math.floor(
      MIDI_V3_MAX_PROJECT_MINUTES * 60 * tempoBpm * MIDI_V3_PPQ,
    );
    if (durationTicks > maximumDurationTicks) {
      context.addIssue({
        code: "custom",
        message: "Project exceeds the ten-minute duration limit",
        path: ["durationTicks"],
      });
    }

    for (const key of ["trackId", "sortOrder"] as const) {
      const seen = new Set<string | number>();
      tracks.forEach((track, index) => {
        if (seen.has(track[key])) {
          context.addIssue({
            code: "custom",
            message: `Duplicate ${key}`,
            path: ["tracks", index, key],
          });
        }
        seen.add(track[key]);
      });
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

    const clipIds = new Set<string>();
    tracks.forEach((track, trackIndex) => {
      track.clips.forEach((clip, clipIndex) => {
        if (clipIds.has(clip.clipId)) {
          context.addIssue({
            code: "custom",
            message: "Duplicate clipId",
            path: ["tracks", trackIndex, "clips", clipIndex, "clipId"],
          });
        }
        clipIds.add(clip.clipId);
        if (clip.startTick + clip.durationTicks > durationTicks) {
          context.addIssue({
            code: "custom",
            message: "Clip exceeds project duration",
            path: ["tracks", trackIndex, "clips", clipIndex],
          });
        }
      });
    });
  });

export type ManifestV3 = z.infer<typeof manifestV3Schema>;
export type ManifestHeaderV3 = Omit<ManifestV3, "tracks">;

export const arrangementManifestV3Schema = manifestV3Schema.refine(
  (manifest) => manifest.workspaceId === undefined,
  {
    message: "Immutable arrangement manifests cannot contain workspaceId",
    path: ["workspaceId"],
  },
);

export const workspaceManifestV3Schema = manifestV3Schema.refine(
  (manifest) => manifest.workspaceId !== undefined,
  {
    message: "Workspace snapshots require workspaceId",
    path: ["workspaceId"],
  },
);

export const arrangementVersionV3Schema = z
  .object({
    arrangementVersionId: z.uuid(),
    creatorId: z.uuid(),
    manifest: arrangementManifestV3Schema,
    manifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type ArrangementManifestV3 = z.infer<typeof arrangementManifestV3Schema>;
export type WorkspaceManifestV3 = ManifestV3 & { workspaceId: string };
export type ArrangementVersionV3 = z.infer<typeof arrangementVersionV3Schema>;

function compareNotes(left: MidiNoteV3, right: MidiNoteV3) {
  return (
    left.startTick - right.startTick ||
    left.pitch - right.pitch ||
    left.noteId.localeCompare(right.noteId)
  );
}

function compareClips(left: WorkspaceClipV3, right: WorkspaceClipV3) {
  return (
    left.startTick - right.startTick || left.clipId.localeCompare(right.clipId)
  );
}

export function canonicalizeMidiNotesV3(notes: readonly MidiNoteV3[]) {
  return [...notes].sort(compareNotes);
}

export function canonicalizePatternContentV3(
  content: PatternContentV3,
): PatternContentV3 {
  return { ...content, notes: canonicalizeMidiNotesV3(content.notes) };
}

export function canonicalizePatternVersionV3(
  patternVersion: MidiPatternVersionV3,
): MidiPatternVersionV3 {
  return {
    ...patternVersion,
    notes: canonicalizeMidiNotesV3(patternVersion.notes),
  };
}

export function canonicalizeManifestV3(manifest: ManifestV3): ManifestV3 {
  return {
    ...manifest,
    tracks: [...manifest.tracks]
      .sort(
        (left, right) =>
          left.sortOrder - right.sortOrder ||
          left.trackId.localeCompare(right.trackId),
      )
      .map((track) => ({
        ...track,
        clips: [...track.clips].sort(compareClips),
      })),
  };
}

export function parseManifestV3(input: unknown): ManifestV3 {
  return canonicalizeManifestV3(manifestV3Schema.parse(input));
}

export function parseArrangementManifestV3(
  input: unknown,
): ArrangementManifestV3 {
  return canonicalizeManifestV3(arrangementManifestV3Schema.parse(input));
}

export function parseWorkspaceManifestV3(input: unknown): WorkspaceManifestV3 {
  return canonicalizeManifestV3(
    workspaceManifestV3Schema.parse(input),
  ) as WorkspaceManifestV3;
}

export function parseMidiPatternVersionV3(
  input: unknown,
): MidiPatternVersionV3 {
  return canonicalizePatternVersionV3(midiPatternVersionV3Schema.parse(input));
}

export async function sha256PatternContentV3(
  content: PatternContentV3,
): Promise<string> {
  return sha256PostgresJsonb(canonicalizePatternContentV3(content));
}

export async function sha256ManifestV3(manifest: ManifestV3): Promise<string> {
  return sha256PostgresJsonb(canonicalizeManifestV3(manifest));
}

export type ArrangementProjectionV3 = {
  header: ManifestHeaderV3;
  tracks: Array<Omit<WorkspaceTrackV3, "clips">>;
  clips: Array<WorkspaceClipV3 & { trackId: string }>;
};

function projectTrackV3(
  track: WorkspaceTrackV3,
): Omit<WorkspaceTrackV3, "clips"> {
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
  };
}

export function projectManifestV3(
  manifest: ManifestV3,
): ArrangementProjectionV3 {
  const canonical = canonicalizeManifestV3(manifest);
  const { tracks, ...header } = canonical;
  return {
    header,
    tracks: tracks.map(projectTrackV3),
    clips: tracks.flatMap((track) =>
      track.clips.map((clip) => ({ ...clip, trackId: track.trackId })),
    ),
  };
}

export function reconstructManifestV3(
  projection: ArrangementProjectionV3,
): ManifestV3 {
  const clipsByTrack = new Map<string, WorkspaceClipV3[]>();
  for (const { trackId, ...clip } of projection.clips) {
    const clips = clipsByTrack.get(trackId) ?? [];
    clips.push(clip);
    clipsByTrack.set(trackId, clips);
  }
  return parseManifestV3({
    ...projection.header,
    tracks: projection.tracks.map((track) => ({
      ...track,
      clips: clipsByTrack.get(track.trackId) ?? [],
    })),
  });
}

export function validateManifestPatternReferencesV3(
  manifest: ManifestV3,
  patternVersions: ReadonlyMap<string, MidiPatternVersionV3>,
): void {
  let resolvedNoteCount = 0;
  for (const track of manifest.tracks) {
    for (const clip of track.clips) {
      const pattern = patternVersions.get(clip.midiPatternVersionId);
      if (!pattern) {
        throw new Error(
          `Missing MIDI pattern version ${clip.midiPatternVersionId}`,
        );
      }
      if (clip.sourceStartTick >= pattern.durationTicks) {
        throw new Error(`Clip ${clip.clipId} starts outside its MIDI pattern`);
      }
      if (
        !clip.loop &&
        clip.sourceStartTick + clip.durationTicks > pattern.durationTicks
      ) {
        throw new Error(`Clip ${clip.clipId} exceeds its MIDI pattern`);
      }
      resolvedNoteCount += pattern.noteCount;
    }
  }
  if (resolvedNoteCount > MIDI_V3_MAX_RESOLVED_NOTES) {
    throw new Error("Arrangement exceeds the resolved MIDI note limit");
  }
}
