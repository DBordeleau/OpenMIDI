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
  visibility: "private";
  status: "draft" | "active";
  currentRevisionId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
