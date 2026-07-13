import type { Database } from "@/lib/supabase/database.types";

export type ContributionStatus =
  Database["public"]["Enums"]["contribution_status"];

export type ContributionVersionSummary = {
  id: string;
  versionNumber: number;
  baseRevisionId: string;
  durationMs: number;
  trackCount: number;
  attestationVersion: string;
  createdAt: string;
};

export type ContributionListItem = {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  status: ContributionStatus;
  baseRevisionId: string;
  currentVersionNumber: number | null;
  updatedAt: string;
};

export type ContributionDetail = {
  id: string;
  projectId: string;
  projectTitle: string;
  projectOwnerId: string;
  authorId: string;
  title: string;
  description: string | null;
  status: ContributionStatus;
  baseRevisionId: string;
  currentProjectRevisionId: string | null;
  currentVersionId: string | null;
  license: { code: string; name: string; url: string; summary: string };
  submittedAt: string | null;
  withdrawnAt: string | null;
  updatedAt: string;
  versions: ContributionVersionSummary[];
};
