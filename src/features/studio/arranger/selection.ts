import type { ArrangerTrack } from "./view-model";

export type ArrangerSelection =
  | { kind: "track"; trackId: string }
  | { kind: "clip"; trackId: string; clipId: string }
  | null;

export function getSelectionOrder(tracks: readonly ArrangerTrack[]) {
  return tracks.flatMap((track) => [
    { kind: "track", trackId: track.trackId } as const,
    ...track.clips.map(
      (clip) =>
        ({
          kind: "clip",
          trackId: track.trackId,
          clipId: clip.clipId,
        }) as const,
    ),
  ]);
}

export function moveSelection(
  tracks: readonly ArrangerTrack[],
  selection: ArrangerSelection,
  delta: -1 | 1,
): ArrangerSelection {
  const order = getSelectionOrder(tracks);
  if (order.length === 0) return null;
  const index = selection
    ? order.findIndex(
        (candidate) =>
          candidate.kind === selection.kind &&
          candidate.trackId === selection.trackId &&
          (candidate.kind === "track" ||
            (selection.kind === "clip" &&
              candidate.clipId === selection.clipId)),
      )
    : -1;
  return order[Math.min(order.length - 1, Math.max(0, index + delta))]!;
}
