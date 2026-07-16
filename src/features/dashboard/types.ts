export type DashboardData = {
  ownedProjects: Array<{
    projectId: string;
    title: string;
    status: "draft" | "active";
    currentRevisionId: string | null;
    updatedAt: string;
  }>;
  activeWorkspaces: Array<{
    workspaceId: string;
    projectId: string;
    projectTitle: string;
    contributionId: string | null;
    contributionTitle: string | null;
    lockVersion: number;
    updatedAt: string;
    archivesAt: string;
    archiveWarning: boolean;
  }>;
  pendingContributions: Array<{
    contributionId: string;
    projectId: string;
    projectTitle: string;
    title: string;
    status: "draft" | "submitted" | "changes_requested";
    currentVersionNumber: number | null;
    updatedAt: string;
  }>;
  review: { count: number; hasMore: boolean };
};
