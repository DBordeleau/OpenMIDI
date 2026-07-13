export type AccountStatus = "active" | "suspended" | "deleted";

export type ViewerProfile = {
  id: string;
  username: string | null;
  displayName: string | null;
  creditName: string | null;
  bio: string | null;
  status: AccountStatus;
  profileCompletedAt: string | null;
};

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  creditName: string;
  bio: string | null;
};

export type PublicProfileHistory = {
  projects: Array<{
    projectId: string;
    title: string;
    publishedAt: string;
  }>;
  acceptedContributions: AcceptedContributionHistoryItem[];
};

export type AcceptedContributionHistoryItem = {
  revisionId: string;
  revisionNumber: number;
  projectId: string;
  projectTitle: string;
  acceptedAt: string;
  creditName: string;
};
