import type {
  MidiClipReferenceV1,
  WorkspaceManifestV2,
  WorkspaceTrackV2,
} from "../manifest/v2";
import { MAX_CLIPS_PER_TRACK, parseWorkspaceManifestV2 } from "../manifest/v2";
export type ArrangementCommandContext = {
  midiVersionDurations: ReadonlyMap<string, number>;
};

export type ArrangementClipboard = {
  kind: "midi";
  sourceTrackId: string;
  presetId: string;
  presetVersion: number;
  clip: MidiClipReferenceV1;
};

export type ArrangementCommand =
  | { type: "patchTrack"; trackId: string; patch: Partial<WorkspaceTrackV2> }
  | { type: "removeTrack"; trackId: string }
  | { type: "reorderTrack"; trackId: string; targetIndex: number }
  | {
      type: "patchClip";
      trackId: string;
      clipId: string;
      patch: Record<string, number | boolean>;
    }
  | { type: "moveClip"; trackId: string; clipId: string; startTick: number }
  | {
      type: "moveClipToTrack";
      sourceTrackId: string;
      targetTrackId: string;
      clipId: string;
      startTick: number;
    }
  | {
      type: "copyClipToTrack";
      sourceTrackId: string;
      targetTrackId: string;
      clipId: string;
      newClipId: string;
      startTick: number;
    }
  | {
      type: "duplicateMidiTrack";
      trackId: string;
      newTrackId: string;
      newClipIds: readonly string[];
    }
  | {
      type: "pasteClip";
      targetTrackId: string;
      clipboard: ArrangementClipboard;
      newClipId: string;
      startTick?: number;
    }
  | {
      type: "materializeMidiTrack";
      trackId: string;
      name: string;
      clipboard: Extract<ArrangementClipboard, { kind: "midi" }>;
      newClipId: string;
      startTick: number;
    }
  | { type: "deleteMidiClip"; trackId: string; clipId: string }
  | {
      type: "replaceMidiVersion";
      trackId: string;
      clipId: string;
      midiStemVersionId: string;
    };

export class ArrangementCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArrangementCommandError";
  }
}

export function copyArrangementClip(
  manifest: WorkspaceManifestV2,
  trackId: string,
  clipId: string,
): ArrangementClipboard {
  const track = findTrack(manifest, trackId);
  const clip = findClip(track, clipId);
  return {
    kind: "midi",
    sourceTrackId: track.trackId,
    presetId: track.presetId,
    presetVersion: track.presetVersion,
    clip: { ...clip },
  };
}

export function applyArrangementCommand(
  manifest: WorkspaceManifestV2,
  command: ArrangementCommand,
  context: ArrangementCommandContext,
): WorkspaceManifestV2 {
  let next: WorkspaceManifestV2;
  switch (command.type) {
    case "patchTrack":
      next = {
        ...manifest,
        tracks: manifest.tracks.map((track) =>
          track.trackId === command.trackId
            ? ({ ...track, ...command.patch } as WorkspaceTrackV2)
            : track,
        ),
      };
      break;
    case "removeTrack":
      assertTrack(manifest, command.trackId);
      next = withContiguousOrder(
        manifest,
        manifest.tracks.filter((track) => track.trackId !== command.trackId),
      );
      break;
    case "reorderTrack": {
      const ordered = [...manifest.tracks].sort(
        (left, right) => left.sortOrder - right.sortOrder,
      );
      const sourceIndex = ordered.findIndex(
        (track) => track.trackId === command.trackId,
      );
      if (sourceIndex < 0)
        throw new ArrangementCommandError("Track not found.");
      const targetIndex = Math.max(
        0,
        Math.min(ordered.length - 1, command.targetIndex),
      );
      const [moved] = ordered.splice(sourceIndex, 1);
      ordered.splice(targetIndex, 0, moved!);
      next = withContiguousOrder(manifest, ordered);
      break;
    }
    case "patchClip":
      next = mapClip(manifest, command.trackId, command.clipId, (clip) => ({
        ...clip,
        ...command.patch,
      }));
      break;
    case "moveClip": {
      if (!Number.isInteger(command.startTick) || command.startTick < 0)
        throw new ArrangementCommandError("Clip start must be zero or later.");
      next = mapClip(manifest, command.trackId, command.clipId, (clip) => ({
        ...clip,
        startTick: command.startTick,
      }));
      break;
    }
    case "moveClipToTrack": {
      if (command.sourceTrackId === command.targetTrackId)
        throw new ArrangementCommandError("Choose a different target track.");
      const sourceTrack = findTrack(manifest, command.sourceTrackId);
      const targetTrack = findTrack(manifest, command.targetTrackId);
      const sourceClip = findClip(sourceTrack, command.clipId);
      assertCompatibleTracks(sourceTrack, targetTrack);
      const movedClip = withClipStart(sourceClip, command.startTick);
      next = withContiguousOrder(
        manifest,
        manifest.tracks.flatMap((track) => {
          if (track.trackId === sourceTrack.trackId)
            return track.clips.length === 1
              ? []
              : [
                  {
                    ...track,
                    clips: track.clips.filter(
                      (clip) => clip.clipId !== command.clipId,
                    ),
                  },
                ];
          if (track.trackId === targetTrack.trackId)
            return [{ ...track, clips: [...track.clips, movedClip] }];
          return [track];
        }) as WorkspaceTrackV2[],
      );
      break;
    }
    case "copyClipToTrack": {
      const sourceTrack = findTrack(manifest, command.sourceTrackId);
      const targetTrack = findTrack(manifest, command.targetTrackId);
      const sourceClip = findClip(sourceTrack, command.clipId);
      assertCompatibleTracks(sourceTrack, targetTrack);
      next = appendClip(
        manifest,
        targetTrack,
        duplicateAtNextOpening(
          manifest,
          targetTrack,
          sourceClip,
          command.newClipId,
          command.startTick,
        ),
      );
      break;
    }
    case "duplicateMidiTrack": {
      const track = findTrack(manifest, command.trackId);
      if (track.kind !== "midi")
        throw new ArrangementCommandError(
          "Only MIDI tracks can be duplicated.",
        );
      if (command.newClipIds.length !== track.clips.length)
        throw new ArrangementCommandError(
          "Every duplicated clip needs a fresh stable ID.",
        );
      next = {
        ...manifest,
        tracks: [
          ...manifest.tracks,
          {
            ...track,
            trackId: command.newTrackId,
            name: `${track.name.slice(0, 115)} copy`,
            sortOrder: manifest.tracks.length,
            clips: track.clips.map((clip, index) => ({
              ...clip,
              clipId: command.newClipIds[index]!,
            })),
          },
        ],
      };
      break;
    }
    case "pasteClip": {
      const track = findTrack(manifest, command.targetTrackId);
      assertCompatibleClipboard(track, command.clipboard);
      next = appendClip(
        manifest,
        track,
        duplicateAtNextOpening(
          manifest,
          track,
          command.clipboard.clip,
          command.newClipId,
          command.startTick,
        ),
      );
      break;
    }
    case "materializeMidiTrack": {
      if (!command.name.trim())
        throw new ArrangementCommandError(
          "Name the track before adding a clip.",
        );
      if (manifest.tracks.some((track) => track.trackId === command.trackId))
        throw new ArrangementCommandError("That pending track already exists.");
      const clip = withClipStart(
        { ...command.clipboard.clip, clipId: command.newClipId },
        command.startTick,
      ) as MidiClipReferenceV1;
      next = {
        ...manifest,
        durationTicks: Math.max(
          manifest.durationTicks,
          clip.startTick + clip.durationTicks,
        ),
        tracks: [
          ...manifest.tracks,
          {
            kind: "midi",
            trackId: command.trackId,
            name: command.name.trim(),
            instrumentId: null,
            presetId: command.clipboard.presetId,
            presetVersion: command.clipboard.presetVersion,
            gainDb: 0,
            pan: 0,
            muted: false,
            soloed: false,
            sortOrder: manifest.tracks.length,
            clips: [clip],
          },
        ],
      };
      break;
    }
    case "deleteMidiClip": {
      const track = findTrack(manifest, command.trackId);
      if (track.kind !== "midi")
        throw new ArrangementCommandError(
          "Only MIDI clips can be deleted here.",
        );
      findClip(track, command.clipId);
      if (track.clips.length === 1) {
        next = withContiguousOrder(
          manifest,
          manifest.tracks.filter(
            (candidate) => candidate.trackId !== command.trackId,
          ),
        );
      } else {
        next = {
          ...manifest,
          tracks: manifest.tracks.map((candidate) =>
            candidate.trackId === command.trackId
              ? {
                  ...candidate,
                  clips: candidate.clips.filter(
                    (clip) => clip.clipId !== command.clipId,
                  ),
                }
              : candidate,
          ) as WorkspaceTrackV2[],
        };
      }
      break;
    }
    case "replaceMidiVersion": {
      const track = findTrack(manifest, command.trackId);
      if (track.kind !== "midi")
        throw new ArrangementCommandError(
          "Only a MIDI clip can replace its immutable version.",
        );
      const duration = context.midiVersionDurations.get(
        command.midiStemVersionId,
      );
      if (!duration)
        throw new ArrangementCommandError(
          "That immutable MIDI version is not available in this session.",
        );
      next = mapClip(manifest, command.trackId, command.clipId, (clip) => ({
        ...clip,
        midiStemVersionId: command.midiStemVersionId,
        sourceStartTick: 0,
        durationTicks: Math.min(
          (clip as MidiClipReferenceV1).durationTicks,
          duration,
        ),
      }));
      break;
    }
  }
  return validateArrangement(expandManifestDuration(next), context);
}

export function snapArrangementTick(tick: number, gridTicks: number | null) {
  const bounded = Math.max(0, Math.round(tick));
  return gridTicks ? Math.round(bounded / gridTicks) * gridTicks : bounded;
}

function validateArrangement(
  manifest: WorkspaceManifestV2,
  context: ArrangementCommandContext,
) {
  let canonical: WorkspaceManifestV2;
  try {
    canonical = parseWorkspaceManifestV2(manifest);
  } catch (error) {
    const issue =
      typeof error === "object" &&
      error !== null &&
      "issues" in error &&
      Array.isArray(error.issues)
        ? error.issues[0]
        : null;
    throw new ArrangementCommandError(
      issue && typeof issue.message === "string"
        ? issue.message
        : "The arrangement change is outside the project limits.",
    );
  }
  for (const track of canonical.tracks) {
    const ordered = [...track.clips].sort(
      (left, right) => clipStart(left) - clipStart(right),
    );
    ordered.forEach((clip, index) => {
      const next = ordered[index + 1];
      if (next && clipStart(clip) + clipDuration(clip) > clipStart(next))
        throw new ArrangementCommandError(
          `Clips on ${track.name} cannot overlap. Move or trim the selected clip.`,
        );
      const sourceDuration = context.midiVersionDurations.get(
        clip.midiStemVersionId,
      );
      if (sourceDuration === undefined)
        throw new ArrangementCommandError(
          `The immutable MIDI source for ${track.name} is unavailable.`,
        );
      if (clip.sourceStartTick >= sourceDuration)
        throw new ArrangementCommandError(
          `The MIDI source offset on ${track.name} is outside its immutable version.`,
        );
      if (
        !clip.loop &&
        clip.sourceStartTick + clip.durationTicks > sourceDuration
      )
        throw new ArrangementCommandError(
          `Enable loop or shorten ${track.name}; the clip exceeds its immutable MIDI source.`,
        );
    });
  }
  return canonical;
}

function assertCompatibleClipboard(
  track: WorkspaceTrackV2,
  clipboard: ArrangementClipboard,
) {
  if (clipboard.kind !== "midi")
    throw new ArrangementCommandError(
      "The target track is not compatible with this clip source.",
    );
}

function assertCompatibleTracks(
  source: WorkspaceTrackV2,
  target: WorkspaceTrackV2,
) {
  if (source.kind !== target.kind)
    throw new ArrangementCommandError("Move MIDI clips between MIDI tracks.");
}

function duplicateAtNextOpening(
  manifest: WorkspaceManifestV2,
  track: WorkspaceTrackV2,
  source: MidiClipReferenceV1,
  newClipId: string,
  preferredStart?: number,
) {
  if (track.clips.length >= MAX_CLIPS_PER_TRACK)
    throw new ArrangementCommandError(
      `A track can contain at most ${MAX_CLIPS_PER_TRACK} clips.`,
    );
  let start =
    preferredStart === undefined
      ? clipStart(source) + clipDuration(source)
      : preferredStart;
  for (const clip of [...track.clips].sort(
    (left, right) => clipStart(left) - clipStart(right),
  )) {
    if (start + clipDuration(source) <= clipStart(clip)) break;
    if (start < clipStart(clip) + clipDuration(clip))
      start = clipStart(clip) + clipDuration(clip);
  }
  return { ...source, clipId: newClipId, startTick: start };
}

function withClipStart(source: MidiClipReferenceV1, startTick: number) {
  if (!Number.isInteger(startTick) || startTick < 0)
    throw new ArrangementCommandError("Clip start must be zero or later.");
  return { ...source, startTick };
}

function appendClip(
  manifest: WorkspaceManifestV2,
  track: WorkspaceTrackV2,
  clip: MidiClipReferenceV1,
) {
  return {
    ...manifest,
    durationTicks: Math.max(
      manifest.durationTicks,
      clip.startTick + clip.durationTicks,
    ),
    tracks: manifest.tracks.map((candidate) =>
      candidate.trackId === track.trackId
        ? { ...candidate, clips: [...candidate.clips, clip] }
        : candidate,
    ) as WorkspaceTrackV2[],
  };
}

function expandManifestDuration(
  manifest: WorkspaceManifestV2,
): WorkspaceManifestV2 {
  const requiredDuration = manifest.tracks.reduce(
    (projectEnd, track) =>
      track.clips.reduce((trackEnd, clip) => {
        const clipEnd = clip.startTick + clip.durationTicks;
        return Math.max(trackEnd, clipEnd);
      }, projectEnd),
    manifest.durationTicks,
  );
  return requiredDuration === manifest.durationTicks
    ? manifest
    : { ...manifest, durationTicks: requiredDuration };
}

function mapClip(
  manifest: WorkspaceManifestV2,
  trackId: string,
  clipId: string,
  update: (clip: MidiClipReferenceV1) => MidiClipReferenceV1,
) {
  const track = findTrack(manifest, trackId);
  findClip(track, clipId);
  return {
    ...manifest,
    tracks: manifest.tracks.map((candidate) =>
      candidate.trackId === trackId
        ? {
            ...candidate,
            clips: candidate.clips.map((clip) =>
              clip.clipId === clipId ? update(clip) : clip,
            ),
          }
        : candidate,
    ) as WorkspaceTrackV2[],
  };
}

function withContiguousOrder(
  manifest: WorkspaceManifestV2,
  tracks: readonly WorkspaceTrackV2[],
): WorkspaceManifestV2 {
  return {
    ...manifest,
    tracks: tracks.map((track, sortOrder) => ({ ...track, sortOrder })),
  };
}

function findTrack(manifest: WorkspaceManifestV2, trackId: string) {
  const track = manifest.tracks.find(
    (candidate) => candidate.trackId === trackId,
  );
  if (!track) throw new ArrangementCommandError("Track not found.");
  return track;
}

function assertTrack(manifest: WorkspaceManifestV2, trackId: string) {
  findTrack(manifest, trackId);
}

function findClip(track: WorkspaceTrackV2, clipId: string) {
  const clip = track.clips.find((candidate) => candidate.clipId === clipId);
  if (!clip) throw new ArrangementCommandError("Clip not found.");
  return clip;
}

function clipStart(clip: MidiClipReferenceV1) {
  return clip.startTick;
}

function clipDuration(clip: MidiClipReferenceV1) {
  return clip.durationTicks;
}
