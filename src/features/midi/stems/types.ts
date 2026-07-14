import type { MidiNoteV1 } from "@/features/studio/manifest/v2";
import type { MidiStemEntryMode } from "./schema";

export type MidiStemDraft = {
  draftId: string;
  stemId: string;
  ownerId: string;
  entryMode: MidiStemEntryMode;
  parentStemVersionId: string | null;
  name: string;
  defaultPresetId: string;
  defaultPresetVersion: number;
  ppq: 480;
  durationTicks: number;
  notes: MidiNoteV1[];
  noteCount: number;
  contentSha256: string;
  lockVersion: number;
  createdAt: string;
  updatedAt: string;
};

export type MidiStemVersionSummary = {
  stemVersionId: string;
  stemId: string;
  version: number;
  name: string;
  noteCount: number;
  defaultPresetId: string;
  defaultPresetVersion: number;
  createdAt: string;
};
