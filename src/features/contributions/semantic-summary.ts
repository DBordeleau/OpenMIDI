import type { MidiSemanticDiffV1 } from "@/features/midi/semantic-diff-v1";

export function summarizeContributionDiff(diff: MidiSemanticDiffV1) {
  return [
    { label: "Arrangement metadata", count: diff.metadata.length },
    { label: "Tracks", count: diff.tracks.length },
    { label: "Clips", count: diff.clips.length },
    { label: "Notes", count: diff.notes.length },
    { label: "Pattern lineage", count: diff.lineage.length },
  ].filter((item) => item.count > 0);
}
