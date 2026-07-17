export type MidiLibraryRights = "all" | "commercial_reuse" | "reference_only";
export type MidiLibraryReuseMode = Exclude<MidiLibraryRights, "all">;
export type MidiLibrarySort = "recent" | "name";
export type MidiLibraryPolyphony = "monophonic" | "polyphonic";

export type NumericRange = { min: number | null; max: number | null };
export type MidiLibraryFilters = {
  query: string | null;
  rights: MidiLibraryRights;
  category: string | null;
  family: string | null;
  preset: string | null;
  tags: string[];
  duration: NumericRange;
  notes: NumericRange;
  pitch: NumericRange;
  polyphony: MidiLibraryPolyphony | null;
  sort: MidiLibrarySort;
  after: string | null;
};
export type MidiLibraryCursor = {
  version: 1;
  sort: MidiLibrarySort;
  filterHash: string;
  listingId: string;
  listedAt: string | null;
  title: string | null;
};
export type MidiLibraryNote = {
  noteId: string;
  startTick: number;
  durationTicks: number;
  pitch: number;
  velocity: number;
};
export type MidiLibraryCredit = {
  creditedName: string;
  role: string;
  workTitle?: string;
  sourceUrl?: string;
  sourceTerms?: string;
  attributionNote?: string;
};
export type MidiLibraryListing = {
  listingId: string;
  midiPatternId: string;
  midiPatternVersionId: string;
  title: string;
  description: string;
  ownerId: string;
  creatorUsername: string;
  creatorDisplayName: string;
  creatorCreditName: string;
  reuseMode: MidiLibraryReuseMode;
  rightsBasis: "original" | "authorized_adaptation" | "public_domain";
  category: { code: string; name: string };
  preset: { id: string; version: number; name: string; family: string };
  tags: Array<{ code: string; name: string }>;
  durationTicks: number;
  durationBeats: number;
  noteCount: number;
  minPitch: number | null;
  maxPitch: number | null;
  polyphony: MidiLibraryPolyphony;
  listedAt: string;
  notes: MidiLibraryNote[];
  externalCredits: MidiLibraryCredit[];
};
export type MidiLibraryPage = {
  listings: MidiLibraryListing[];
  nextCursor: string | null;
};
export type MidiLibraryOptions = {
  categories: Array<{ code: string; name: string }>;
  tags: Array<{ code: string; name: string }>;
  presets: Array<{
    id: string;
    version: number;
    name: string;
    family: string;
  }>;
};
export type OwnedMidiLibraryVersion = {
  patternId: string;
  patternName: string;
  patternVersionId: string;
  versionNumber: number;
  createdAt: string;
  reuseLicenseCode: string | null;
  durationTicks: number;
  noteCount: number;
  activeListingId: string | null;
  activeListingPatternVersionId: string | null;
  activeReuseMode: MidiLibraryReuseMode | null;
  activeCreatorVersion: number | null;
};

export type MidiLibraryHistoryVersion = {
  midiPatternVersionId: string;
  midiPatternId: string;
  versionNumber: number;
  creatorId: string;
  creatorCreditName: string;
  parentMidiPatternVersionId: string | null;
  sourceMidiPatternVersionId: string | null;
  ppq: 480;
  durationTicks: number;
  noteCount: number;
  contentSha256: string;
  reuseLicenseCode: string | null;
  reuseLicenseVersion: string | null;
  reuseLicenseUrl: string | null;
  createdAt: string;
  notes: MidiLibraryNote[];
};

export type MidiLibraryDetail = {
  listing: MidiLibraryListing & {
    attestationVersion: string;
    attestedAt: string;
    supportingSourceUrl: string | null;
    supportingSourceTerms: string | null;
    publicDomainRationale: string | null;
  };
  platformLineage: {
    patternId: string;
    sourcePatternId?: string;
    sourcePatternVersionId?: string;
    sourceCreatorCreditName?: string;
    listedVersionParentId?: string;
    listedVersionSourceId?: string;
  };
  history: MidiLibraryHistoryVersion[];
  usage: {
    publicProjectCount: number;
    projects: Array<{
      projectId: string;
      title: string;
      revisionId: string;
      revisionNumber: number;
      publishedAt: string;
    }>;
  };
};

export type MidiLibraryPatternComparison = {
  listingId: string;
  from: MidiLibraryHistoryVersion;
  to: MidiLibraryHistoryVersion;
};

export type MidiLibraryReportClaimantRole =
  "rightsholder" | "authorized_representative" | "observer" | "other";

export type AdminMidiLibraryReport = {
  id: string;
  listingId: string;
  midiPatternId: string;
  midiPatternVersionId: string;
  title: string;
  reason: "unoriginal_or_unauthorized";
  claimantRole: MidiLibraryReportClaimantRole;
  originalWorkTitle?: string;
  sourceUrl?: string;
  evidence: string;
  status: "submitted" | "reviewing" | "resolved" | "dismissed";
  reporterId: string;
  assignedAdminId?: string;
  createdAt: string;
  updatedAt: string;
  targetState: "visible" | "hidden";
  targetVersion: number;
  unlistedAt?: string;
};
