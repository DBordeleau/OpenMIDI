import { z } from "zod";

export const challengeStateSchema = z.enum([
  "draft",
  "published",
  "completed",
  "cancelled",
]);
export const challengePhaseSchema = z.enum([
  "draft",
  "scheduled",
  "open",
  "voting",
  "completed",
  "cancelled",
]);

export type ChallengeState = z.infer<typeof challengeStateSchema>;
export type ChallengePhase = z.infer<typeof challengePhaseSchema>;

export function deriveChallengePhase(input: {
  state: ChallengeState;
  opensAt: string | Date;
  submissionsCloseAt: string | Date;
  now?: string | Date;
}): ChallengePhase {
  if (
    input.state === "draft" ||
    input.state === "completed" ||
    input.state === "cancelled"
  )
    return input.state;
  const now = toMillis(input.now ?? new Date());
  if (now < toMillis(input.opensAt)) return "scheduled";
  if (now < toMillis(input.submissionsCloseAt)) return "open";
  return "voting";
}

export function challengePhaseMessage(input: {
  phase: ChallengePhase;
  now?: string | Date;
  votingOpensAt: string | Date;
  votingClosesAt: string | Date;
}) {
  if (input.phase !== "voting") return phaseLabels[input.phase];
  const now = toMillis(input.now ?? new Date());
  if (now < toMillis(input.votingOpensAt)) return "Voting opens soon";
  if (now >= toMillis(input.votingClosesAt)) return "Results pending";
  return "Voting";
}

/**
 * Plain-language phase names. Musicians read "Upcoming / Ongoing / Finished"
 * without translating; "scheduled" and "open" are scheduling-system words that
 * describe our state machine rather than what the visitor can do.
 */
export const phaseLabels: Record<ChallengePhase, string> = {
  draft: "Draft",
  scheduled: "Upcoming",
  open: "Ongoing",
  voting: "Voting",
  completed: "Finished",
  cancelled: "Cancelled",
};

export function isChallengePubliclyAddressable(input: {
  publishedAt: string | null;
}) {
  return input.publishedAt !== null;
}

function toMillis(value: string | Date) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) throw new Error("challenge_time_invalid");
  return time;
}
