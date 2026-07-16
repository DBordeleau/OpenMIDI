import type { MusicalKey, TaxonomyOption } from "@/features/projects/types";

export type DiscoverySort = "recent" | "trending";
export type DiscoveryFilters = {
  query: string | null;
  genres: string[];
  tags: string[];
  instruments: string[];
  keys: MusicalKey[];
  bpmMin: number | null;
  bpmMax: number | null;
  openOnly: boolean;
  sort: DiscoverySort;
  after: string | null;
};
export type DiscoveryCursor = {
  version: 1;
  sort: DiscoverySort;
  filterHash: string;
  discoveryVersion: number;
  projectId: string;
  publishedAt: string;
  score: number | null;
};
export type PublicTrack = {
  id: string;
  name: string;
  sortOrder: number;
  preset: { id: string; version: number };
  clipCount: number;
};
export type PublicAttribution = {
  kind: "publisher" | "accepted_contributor";
  creditName: string;
  profileId: string;
  profileUsername: string | null;
};
export type PublicProject = {
  projectId: string;
  ownerId: string;
  ownerUsername: string;
  ownerDisplayName: string;
  title: string;
  description: string | null;
  bpm: number | null;
  musicalKey: MusicalKey | null;
  timeSignature: { numerator: number; denominator: number } | null;
  license: {
    code: string;
    name: string;
    url: string | null;
    summary: string;
    allowsDerivatives: boolean;
  };
  openToContributions: boolean;
  currentRevisionId: string;
  revisionNumber: number;
  durationMs: number;
  publishedAt: string;
  updatedAt: string;
  genres: (TaxonomyOption & { isPrimary: boolean })[];
  tags: TaxonomyOption[];
  tracks: PublicTrack[];
  attributions: PublicAttribution[];
  trendingScore: number;
  discoveryVersion: number;
};
export type DiscoveryPage = {
  projects: PublicProject[];
  nextCursor: string | null;
  discoveryVersion: number;
};
export type DiscoveryOptions = {
  genres: TaxonomyOption[];
  tags: TaxonomyOption[];
  instruments: TaxonomyOption[];
};
export type PublicProjectLineage = {
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
    publishedAt: string;
  }>;
  hasMoreDirectForks: boolean;
};
