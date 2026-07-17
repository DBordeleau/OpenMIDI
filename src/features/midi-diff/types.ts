import type { MidiNoteV3 } from "@/features/midi/domain-v3";

export type MidiDiffChangeState = "added" | "changed" | "removed";
export type MidiDiffSide = "before" | "after";

export const MIDI_DIFF_VISUAL_STATES = {
  added: {
    label: "Added",
    marker: "+",
    color: "gold",
    lineStyle: "solid",
    beforeVisible: false,
    afterVisible: true,
  },
  changed: {
    label: "Changed",
    marker: "~",
    color: "coral",
    lineStyle: "solid",
    beforeVisible: true,
    afterVisible: true,
  },
  removed: {
    label: "Removed",
    marker: "−",
    color: "muted",
    lineStyle: "dashed",
    beforeVisible: true,
    afterVisible: false,
  },
} as const satisfies Record<
  MidiDiffChangeState,
  {
    label: string;
    marker: string;
    color: "gold" | "coral" | "muted";
    lineStyle: "solid" | "dashed";
    beforeVisible: boolean;
    afterVisible: boolean;
  }
>;

export type MidiDiffFieldDetail = {
  field: string;
  label: string;
  before: string;
  after: string;
};

export type MidiDiffPatternCredit = {
  midiPatternVersionId: string;
  midiPatternId: string;
  version: number;
  creatorCreditName: string;
  parentMidiPatternVersionId: string | null;
  sourceMidiPatternVersionId: string | null;
  reuseLicenseCode: string | null;
  reuseLicenseUrl: string | null;
};

export type MidiDiffNoteGeometry = Pick<
  MidiNoteV3,
  "startTick" | "durationTicks" | "pitch" | "velocity"
> & {
  pitchName: string;
  positionLabel: string;
  durationLabel: string;
};

export type MidiDiffNote = {
  noteId: string;
  state: MidiDiffChangeState;
  marker: string;
  label: string;
  before: MidiDiffNoteGeometry | null;
  after: MidiDiffNoteGeometry | null;
  changedFacets: string[];
  details: MidiDiffFieldDetail[];
  overlay: {
    beforeVisible: boolean;
    afterVisible: boolean;
    lineStyle: "solid" | "dashed";
  };
};

export type MidiDiffNoteContext = {
  noteId: string;
  before: MidiDiffNoteGeometry | null;
  after: MidiDiffNoteGeometry | null;
};

export type MidiDiffTrackSide = {
  name: string;
  orderLabel: string;
  presetName: string;
  presetTechnicalName: string;
  gainLabel: string;
  panLabel: string;
  mutedLabel: string;
  soloedLabel: string;
};

export type MidiDiffClipSide = {
  trackId: string;
  trackName: string;
  positionLabel: string;
  durationLabel: string;
  sourcePositionLabel: string;
  loopLabel: string;
  noteCount: number;
  pattern: MidiDiffPatternCredit;
};

export type MidiDiffClip = {
  selectionId: string;
  clipId: string;
  state: MidiDiffChangeState;
  states: MidiDiffChangeState[];
  marker: string;
  label: string;
  contextLabel: string;
  before: MidiDiffClipSide | null;
  after: MidiDiffClipSide | null;
  details: MidiDiffFieldDetail[];
  noteChanges: MidiDiffNote[];
  noteContext: MidiDiffNoteContext[];
  lineageDetails: MidiDiffFieldDetail[];
};

export type MidiDiffTrack = {
  selectionId: string;
  trackId: string;
  state: MidiDiffChangeState;
  states: MidiDiffChangeState[];
  marker: string;
  label: string;
  contextLabel: string;
  before: MidiDiffTrackSide | null;
  after: MidiDiffTrackSide | null;
  details: MidiDiffFieldDetail[];
  clips: MidiDiffClip[];
};

export type MidiDiffCounts = Record<
  MidiDiffChangeState,
  {
    total: number;
    tracks: number;
    clips: number;
    notes: number;
    arrangementFields: number;
    lineage: number;
  }
>;

export type MidiDiffReadyViewModel = {
  status: "ready";
  algorithmVersion: string;
  sideLabels: { before: string; after: string };
  counts: MidiDiffCounts;
  summary: {
    arrangementFields: number;
    tracks: number;
    clips: number;
    uniqueNotes: number;
    lineage: number;
  };
  arrangementDetails: MidiDiffFieldDetail[];
  tracks: MidiDiffTrack[];
  credits: MidiDiffPatternCredit[];
  defaultSelectionId: string | null;
};

export type MidiDiffViewModel =
  | MidiDiffReadyViewModel
  | {
      status: "unchanged";
      algorithmVersion: string;
      sideLabels: { before: string; after: string };
      credits: MidiDiffPatternCredit[];
    }
  | {
      status: "unavailable";
      title: string;
      message: string;
    }
  | {
      status: "inconsistent";
      title: string;
      message: string;
    };
