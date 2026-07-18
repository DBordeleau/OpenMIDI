export type ChallengeFormActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  challengeId?: string;
  lifecycleVersion?: number;
};

export const initialChallengeFormActionState: ChallengeFormActionState = {
  status: "idle",
};
