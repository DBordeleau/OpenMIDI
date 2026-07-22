import type { AvatarConfigV1 } from "./avatar/contract";

export type AccountStatus = "active" | "suspended" | "deleted";

export type ViewerProfile = {
  id: string;
  username: string | null;
  displayName: string | null;
  creditName: string | null;
  bio: string | null;
  status: AccountStatus;
  profileCompletedAt: string | null;
  avatarConfig: AvatarConfigV1 | null;
  avatarConfigRevision: number;
};

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  creditName: string;
  bio: string | null;
  avatarConfig: AvatarConfigV1 | null;
};

export type PublicProfileHistory = {
  projects: Array<{
    projectId: string;
    title: string;
    publishedAt: string;
  }>;
  acceptedContributions: AcceptedContributionHistoryItem[];
};

export type PublicProfilePage<T> = { items: T[]; nextCursor: string | null };

export type AcceptedContributionHistoryItem = {
  revisionId: string;
  revisionNumber: number;
  projectId: string;
  projectTitle: string;
  acceptedAt: string;
  creditName: string;
};
