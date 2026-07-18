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

export type Challenge = {
  id: string;
  slug: string;
  state: ChallengeState;
  phase: ChallengePhase;
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
  cancelledAt: string | null;
  cancellationNote: string | null;
  createdAt: string;
  updatedAt: string;
};
