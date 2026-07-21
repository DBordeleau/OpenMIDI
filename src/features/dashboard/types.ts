export type DashboardBoundedCount = { count: number; hasMore: boolean };

export type DashboardData = {
  ownedProjects: Array<{
    projectId: string;
    title: string;
    status: "draft" | "active";
    currentRevisionId: string | null;
    revisionNumber: number | null;
    trackCount: number;
    reviewCount: number;
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
  review: DashboardBoundedCount;
  resume: {
    workspaceId: string;
    projectId: string;
    projectTitle: string;
    contributionId: string | null;
    contributionTitle: string | null;
    updatedAt: string;
    lockVersion: number;
    tempoBpm: number;
    durationTicks: number;
    musicalKey: string | null;
    timeSignatureNumerator: number;
    timeSignatureDenominator: number;
    tracks: Array<{
      trackId: string;
      sortOrder: number;
      presetId: string;
      name: string;
      clips: Array<{
        clipId: string;
        startTick: number;
        durationTicks: number;
        /** Null when the placed pattern version can no longer be resolved. */
        patternName: string | null;
      }>;
    }>;
  } | null;
  recentClips: Array<{
    patternId: string;
    patternName: string;
    patternVersionId: string;
    versionNumber: number;
    projectId: string;
    projectTitle: string;
    workspaceId: string;
    clipId: string;
    durationTicks: number;
    noteCount: number;
    updatedAt: string;
  }>;
  counts: {
    projects: DashboardBoundedCount;
    clips: DashboardBoundedCount;
    savedClips: DashboardBoundedCount;
    pendingContributions: DashboardBoundedCount;
    archivingSoon: DashboardBoundedCount;
  };
};
