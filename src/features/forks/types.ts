import type { LicenseOption } from "@/features/projects/types";

export type ForkSource = {
  projectId: string;
  projectTitle: string;
  projectDescription: string | null;
  revisionId: string;
  revisionNumber: number;
  durationMs: number;
  trackCount: number;
  license: LicenseOption;
};

export type ProjectLineage = {
  source: {
    projectId: string;
    title: string;
    revisionId: string;
    revisionNumber: number;
  } | null;
  sourceUnavailable: boolean;
  directForks: Array<{
    projectId: string;
    title: string;
    createdAt: string;
  }>;
  hasMoreDirectForks: boolean;
};
