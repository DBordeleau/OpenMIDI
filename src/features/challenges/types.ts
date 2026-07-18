import type { CanonicalChallengeConstraintsV1 } from "./constraint-v1";
import type { ChallengePhase, ChallengeState } from "./lifecycle";

export type ChallengeJudgeCredit = {
  position: number;
  role: "host" | "judge";
  displayName: string;
  profileId: string | null;
  creditName: string;
};

export type ChallengeStarter = {
  projectId: string;
  revisionId: string;
  projectTitle: string;
  creatorCreditName: string;
  revisionNumber: number;
  licenseCode: string;
  available: boolean;
} | null;

export type ChallengeResultEntry = {
  entryId: string;
  projectTitle: string;
  entrantUsername: string;
  entrantDisplayName: string;
  entrantCreditName: string;
  revisionNumber: number;
  revisionMessage: string | null;
  attributions: Array<{
    kind: "publisher" | "accepted_contributor";
    creditName: string;
  }>;
  durationMs: number;
  submittedAt: string;
  voteTotal: number;
};

export type ChallengeResult = {
  id: string;
  version: number;
  finalizedAt: string;
  note: string;
  entries: ChallengeResultEntry[];
  placements: Array<{
    place: number;
    label: string;
    entryId: string;
    projectTitle: string;
    entrantUsername: string;
    entrantCreditName: string;
  }>;
  communityFavorites: Array<{
    entryId: string;
    projectTitle: string;
    entrantUsername: string;
    entrantCreditName: string;
    voteTotal: number;
  }>;
  supersedesResultId: string | null;
  correctionReason: string | null;
};

export type Challenge = {
  id: string;
  slug: string;
  state: ChallengeState;
  phase: ChallengePhase;
  acceptsVotes: boolean;
  lifecycleVersion: number;
  currentVersionId: string;
  versionNumber: number;
  title: string;
  prompt: string;
  description: string;
  eligibilityTerms: string;
  presentationCode: "pulse" | "nocturne" | "sunrise";
  opensAt: string;
  submissionsCloseAt: string;
  votingOpensAt: string;
  votingClosesAt: string;
  resultsExpectedAt: string;
  judgingMode: "community" | "judged" | "hybrid";
  officialPlacementCount: number;
  constraints: CanonicalChallengeConstraintsV1;
  constraintsSha256: string;
  judges: ChallengeJudgeCredit[];
  starter: ChallengeStarter;
  publishedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationNote: string | null;
  createdAt: string;
  updatedAt: string;
  moderationState: "visible" | "hidden" | null;
  moderationVersion: number | null;
  currentResultId: string | null;
  result: ChallengeResult | null;
};

export type FeaturedChallenge = {
  selectionKind: "selected" | "next_scheduled" | "active" | "recent_completed";
  label: string;
  challenge: Challenge;
};
