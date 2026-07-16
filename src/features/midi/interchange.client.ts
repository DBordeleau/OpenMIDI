import { Midi } from "@tonejs/midi";
import {
  MAX_MIDI_NOTES_PER_STEM,
  MAX_PROJECT_MINUTES,
  MIDI_PPQ,
  type MidiStemVersionV1,
} from "@/features/studio/manifest/v2";
import {
  mapGeneralMidiProgram,
  type GeneralMidiPresetMapping,
} from "./general-midi";

const MAX_MIDI_FILE_BYTES = 1_048_576;

export type ImportedMidiNote = {
  pitch: number;
  velocity: number;
  startTick: number;
  durationTicks: number;
};

export type ImportedMidiData = {
  name: string;
  tempoBpm: number;
  durationTicks: number;
  notes: ImportedMidiNote[];
  suggestedPreset: GeneralMidiPresetMapping;
  instrumentMappings: (GeneralMidiPresetMapping & { trackName: string })[];
  warnings: string[];
};

export function exportMidiStemVersion(
  stem: MidiStemVersionV1,
  tempoBpm: number,
  creatorCreditName?: string,
): Uint8Array {
  const midi = new Midi();
  midi.header.fromJSON({
    name: stem.name,
    ppq: MIDI_PPQ,
    tempos: [{ bpm: tempoBpm, ticks: 0 }],
    timeSignatures: [{ ticks: 0, timeSignature: [4, 4] }],
    keySignatures: [],
    meta: creatorCreditName
      ? [
          {
            ticks: 0,
            type: "text" as const,
            text: `Created by ${creatorCreditName}`,
          },
        ]
      : [],
  });
  const track = midi.addTrack();
  track.name = stem.name;
  for (const note of stem.notes) {
    track.addNote({
      midi: note.pitch,
      velocity: note.velocity / 127,
      ticks: note.startTick,
      durationTicks: note.durationTicks,
    });
  }
  track.endOfTrackTicks = stem.durationTicks;
  return midi.toArray();
}

export function importMidiBytes(bytes: Uint8Array): ImportedMidiData {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_MIDI_FILE_BYTES) {
    throw new RangeError("MIDI file must be between 1 byte and 1 MiB");
  }
  let midi: Midi;
  try {
    midi = new Midi(bytes);
  } catch (error) {
    throw new Error("MIDI file is malformed or unsupported", { cause: error });
  }
  if (midi.header.tempos.length > 1)
    throw new Error("Tempo maps are not supported");
  if (midi.header.timeSignatures.length > 1) {
    throw new Error("Time-signature changes are not supported");
  }
  const tempoBpm = midi.header.tempos[0]?.bpm ?? 120;
  if (!Number.isFinite(tempoBpm) || tempoBpm < 20 || tempoBpm > 300) {
    throw new RangeError("MIDI tempo must be between 20 and 300 BPM");
  }
  const scale = MIDI_PPQ / midi.header.ppq;
  const notes = midi.tracks
    .flatMap((track) => track.notes)
    .map((note) => ({
      pitch: note.midi,
      velocity: Math.max(1, Math.min(127, Math.round(note.velocity * 127))),
      startTick: Math.max(0, Math.round(note.ticks * scale)),
      durationTicks: Math.max(1, Math.round(note.durationTicks * scale)),
    }))
    .sort(
      (left, right) =>
        left.startTick - right.startTick ||
        left.pitch - right.pitch ||
        left.durationTicks - right.durationTicks ||
        left.velocity - right.velocity,
    );
  if (notes.length > MAX_MIDI_NOTES_PER_STEM)
    throw new RangeError("MIDI note limit exceeded");
  const durationTicks = Math.max(
    1,
    ...notes.map(({ startTick, durationTicks }) => startTick + durationTicks),
  );
  const maxDurationTicks = MAX_PROJECT_MINUTES * 60 * tempoBpm * MIDI_PPQ;
  if (durationTicks > maxDurationTicks)
    throw new RangeError("MIDI duration limit exceeded");
  const ignoredEvents = midi.tracks.reduce(
    (total, track) =>
      total +
      Object.values(track.controlChanges).flat().length +
      track.pitchBends.length,
    0,
  );
  const instrumentMappings = midi.tracks
    .filter((track) => track.notes.length > 0)
    .map((track) => ({
      ...mapGeneralMidiProgram(
        track.instrument.number,
        track.instrument.percussion,
      ),
      trackName: track.name.trim(),
      noteCount: track.notes.length,
    }));
  const suggestedPreset =
    [...instrumentMappings].sort(
      (left, right) => right.noteCount - left.noteCount,
    )[0] ?? mapGeneralMidiProgram(0);
  const warnings: string[] = [];
  if (midi.tracks.length > 1) {
    warnings.push(
      `Merged ${midi.tracks.length} MIDI tracks into one stem draft.`,
    );
  }
  if (ignoredEvents > 0) {
    warnings.push(`Ignored ${ignoredEvents} unsupported controller events.`);
  }
  if (midi.header.meta.length > 0) {
    warnings.push(
      `Ignored ${midi.header.meta.length} unsupported text or attribution ${midi.header.meta.length === 1 ? "event" : "events"}.`,
    );
  }
  if (
    instrumentMappings.some(
      ({ program, percussion }) => program !== 0 || percussion,
    )
  ) {
    warnings.push(
      "Mapped General MIDI programs to the closest Jam Session instrument families.",
    );
  }
  if (midi.tracks.filter((track) => track.name.trim()).length > 1) {
    warnings.push("Kept the file name and ignored additional track names.");
  }
  const timeSignature = midi.header.timeSignatures[0]?.timeSignature;
  if (timeSignature && (timeSignature[0] !== 4 || timeSignature[1] !== 4)) {
    warnings.push(
      `Ignored the ${timeSignature[0]}/${timeSignature[1]} time signature; stem timing remains tick-based.`,
    );
  }
  return {
    name: (
      midi.name.trim() ||
      midi.tracks.find((track) => track.name.trim())?.name.trim() ||
      "Imported MIDI stem"
    ).slice(0, 120),
    tempoBpm,
    durationTicks,
    notes,
    suggestedPreset,
    instrumentMappings: instrumentMappings.map((mapping) => ({
      program: mapping.program,
      percussion: mapping.percussion,
      presetId: mapping.presetId,
      version: mapping.version,
      family: mapping.family,
      trackName: mapping.trackName,
    })),
    warnings,
  };
}
