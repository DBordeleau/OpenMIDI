import type { ChallengePreflight } from "./entry-contract";

export type ChallengeEntryActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  preflight?: ChallengePreflight;
  entryId?: string;
};

export const initialChallengeEntryActionState: ChallengeEntryActionState = {
  status: "idle",
};
