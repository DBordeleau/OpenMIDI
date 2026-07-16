import type { Database } from "@/lib/supabase/database.types";
import type { MidiSemanticDiffV1 } from "@/features/midi/semantic-diff-v1";
import type { ArrangementManifestV3 } from "@/features/studio/manifest/v3";
import type { StudioPatternVersion } from "@/features/studio/midi-adapter/manifest-v3-editor";

export type ContributionStatus =
  Database["public"]["Enums"]["contribution_status"];
export type ContributionReviewDecision =
  Database["public"]["Enums"]["contribution_review_decision"];
export type ContributionReviewReason =
  Database["public"]["Enums"]["contribution_review_reason"];

export type ContributionVersionSummary = {
  id: string;
  arrangementVersionId: string;
  versionNumber: number;
  baseRevisionId: string;
  durationMs: number;
  trackCount: number;
  attestationVersion: string;
  createdAt: string;
};

export type PatternCreatorAttribution = {
  midiPatternVersionId: string;
  midiPatternId: string;
  creatorId: string;
  creatorCreditName: string;
  parentMidiPatternVersionId: string | null;
  sourceMidiPatternVersionId: string | null;
  reuseLicenseCode: string | null;
  reuseLicenseUrl: string | null;
};

export type ContributionArrangementComparison = {
  baseArrangementVersionId: string;
  submittedArrangementVersionId: string;
  base: ContributionReviewStudio;
  submitted: ContributionReviewStudio;
  semanticDiff: MidiSemanticDiffV1;
  patternAttributions: PatternCreatorAttribution[];
};

export type ContributionReviewStudio = {
  manifest: ArrangementManifestV3;
  patternVersions: StudioPatternVersion[];
};

export type ContributionListItem = {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  status: ContributionStatus;
  baseRevisionId: string;
  currentVersionNumber: number | null;
  trackCount?: number;
  durationMs?: number;
  submittedAt?: string | null;
  baseRevisionNumber?: number | null;
  currentRevisionNumber?: number | null;
  isStale?: boolean;
  updatedAt: string;
};

export type ContributionListPage = {
  contributions: ContributionListItem[];
  nextCursor: string | null;
};

export type ContributionReviewSummary = {
  id: string;
  versionId: string;
  requestedDecision: ContributionReviewDecision;
  appliedDecision: ContributionReviewDecision;
  reason: ContributionReviewReason | null;
  note: string | null;
  resultingRevisionId: string | null;
  createdAt: string;
};

export type ContributionDetail = {
  id: string;
  projectId: string;
  projectTitle: string;
  projectOwnerId: string;
  authorId: string;
  title: string;
  description: string | null;
  status: ContributionStatus;
  baseRevisionId: string;
  currentProjectRevisionId: string | null;
  baseRevisionNumber: number;
  currentProjectRevisionNumber: number | null;
  currentVersionId: string | null;
  acceptedRevisionId: string | null;
  acceptedRevisionNumber: number | null;
  license: { code: string; name: string; url: string; summary: string };
  submittedAt: string | null;
  withdrawnAt: string | null;
  updatedAt: string;
  reviews: ContributionReviewSummary[];
  versions: ContributionVersionSummary[];
  moderationState: "visible" | "hidden";
};
