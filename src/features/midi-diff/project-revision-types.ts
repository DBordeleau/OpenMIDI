import type { MidiSemanticDiffV1 } from "@/features/midi/semantic-diff-v1";
import type { MidiPatternVersionV3 } from "@/features/midi/domain-v3";
import type { ArrangementManifestV3 } from "@/features/studio/manifest/v3";

export type ProjectRevisionOption = {
  id: string;
  revisionNumber: number;
  parentRevisionId: string | null;
  message: string | null;
  createdAt: string;
};

export type ProjectRevisionComparisonSide = {
  revisionId: string;
  revisionNumber: number;
  arrangementVersionId: string;
  manifest: ArrangementManifestV3;
  patternVersions: MidiPatternVersionV3[];
  attributions: Array<{
    kind: "publisher" | "accepted_contributor";
    creditName: string;
  }>;
};

export type ProjectRevisionComparison = {
  project: { id: string; title: string };
  revisions: ProjectRevisionOption[];
  before: ProjectRevisionComparisonSide;
  after: ProjectRevisionComparisonSide;
  semanticDiff: MidiSemanticDiffV1;
  onlyRevision: boolean;
};

export type ProjectRevisionComparisonResult =
  | { status: "not_found" }
  | {
      status: "unavailable" | "over_limit";
      project: { id: string; title: string };
    }
  | {
      status: "ready";
      comparison: ProjectRevisionComparison;
      canonicalPair: { from: string; to: string };
    };
