import type { StudioClipFailureCode } from "./actions";
import type { StudioClipCollection } from "./schema";

type StudioClipItem = StudioClipCollection["items"][number];

const availabilityMessages: Record<
  StudioClipItem["availability"],
  string | null
> = {
  available: null,
  unlisted: "This saved version is no longer listed for new reuse.",
  moderation_hidden:
    "This saved version is unavailable while its listing is under review.",
  source_unavailable: "The source pattern is no longer available.",
  reference_only: "This version is shared for listening, not reuse.",
  license_unavailable:
    "Reusable licensing can no longer be verified for this version.",
  preset_unavailable:
    "Its bundled instrument is not available in this Studio version.",
};

const failureMessages: Record<StudioClipFailureCode, string> = {
  unauthenticated: "Sign in again before opening your clip collection.",
  actor_ineligible:
    "This account cannot use private Studio clip collections right now.",
  workspace_unavailable:
    "This Studio workspace is no longer available for editing.",
  workspace_stale:
    "This workspace changed elsewhere. Preserve your local work, then reload before adding the clip.",
  saved_source_unavailable:
    "That saved clip is no longer available for reuse. Your bookmark is still shown for context.",
  source_unavailable:
    "That exact pattern version is no longer available to this account.",
  invalid_start_tick:
    "Move the playhead inside the arrangement, then try adding the clip again.",
  request_mismatch:
    "That add request no longer matches this clip. Close the collection and try again.",
  track_limit: "This arrangement already has the maximum number of tracks.",
  note_limit: "Adding this clip would exceed the arrangement note limit.",
  invalid_request:
    "That clip request could not be checked. Close the collection and try again.",
  unavailable: "The clip collection is taking a moment to tune up. Try again.",
};

export function studioClipAvailabilityMessage(item: StudioClipItem) {
  return availabilityMessages[item.availability];
}

export function studioClipFailureMessage(code: StudioClipFailureCode) {
  return failureMessages[code];
}

export function formatStudioClipDuration(durationTicks: number) {
  const beats = durationTicks / 480;
  return `${Number.isInteger(beats) ? beats : beats.toFixed(1)} ${
    beats === 1 ? "beat" : "beats"
  }`;
}

export function studioClipContext(item: StudioClipItem) {
  if (item.source === "owned" && item.isSaved) return "Yours · also saved";
  if (item.source === "owned")
    return item.hasLineage ? "Yours · has lineage" : "Yours";
  return item.hasLineage ? "Saved · has lineage" : "Saved exact version";
}
