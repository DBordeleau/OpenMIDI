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
