import type { musicalKeys } from "./schema";
export type MusicalKey = (typeof musicalKeys)[number];
export type LicenseOption = {
  code: string;
  name: string;
  url: string;
  summary: string;
};
export type TaxonomyOption = { id: string; slug: string; name: string };
export type ProjectFormOptions = {
  licenses: LicenseOption[];
  genres: TaxonomyOption[];
  tags: TaxonomyOption[];
};
export type ProjectSummary = {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  role: "owner" | "editor" | "viewer";
  currentRevisionId: string | null;
  updatedAt: string;
};
export type ProjectDetail = {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  bpm: number | null;
  musicalKey: MusicalKey | null;
  timeSignature: { numerator: number; denominator: number };
  license: LicenseOption;
  genres: (TaxonomyOption & { isPrimary: boolean })[];
  tags: TaxonomyOption[];
  lockVersion: number;
  viewerRole: "owner" | "editor" | "viewer";
  openToContributions: boolean;
  visibility: "private";
  status: "draft" | "active";
  currentRevisionId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
