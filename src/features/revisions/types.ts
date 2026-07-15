export type PublishAssetOption = {
  id: string;
  filename: string;
  mediaType: string;
  byteSize: number;
  durationMs: number;
  sampleRateHz: number;
  channels: number;
  creditName: string;
};
export type InstrumentOption = { id: string; name: string };
export type RevisionPlaybackTrack = {
  trackId: string;
  kind: "audio" | "midi";
  assetId: string | null;
  displayName: string;
  verifiedDurationMs: number;
  instrumentName: string | null;
  creditName: string;
  credits: CreditSnapshot[];
};
export type RevisionTrack = {
  id: string;
  kind: "audio" | "midi";
  assetId: string | null;
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
