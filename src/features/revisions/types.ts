export type RevisionTrack = {
  id: string;
  kind: "midi";
  instrumentName: string | null;
  name: string;
  durationMs: number;
  sortOrder: number;
  creditName: string;
  credits: CreditSnapshot[];
};
export type RevisionSummary = {
  id: string;
  revisionNumber: number;
  message: string | null;
  durationMs: number;
  createdAt: string;
  authorName: string;
  publisher: RevisionAttribution;
  acceptedContributor: RevisionAttribution | null;
  tracks: RevisionTrack[];
};
import type {
  CreditSnapshot,
  RevisionAttribution,
} from "@/features/credits/types";
