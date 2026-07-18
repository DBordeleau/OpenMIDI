export type ChallengeCommunityActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  active?: boolean;
};

export const initialChallengeCommunityActionState: ChallengeCommunityActionState =
  { status: "idle" };
