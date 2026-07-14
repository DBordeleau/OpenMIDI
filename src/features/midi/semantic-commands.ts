import {
  midiNoteV1Schema,
  type MidiNoteV1,
} from "@/features/studio/manifest/v2";

export const QUANTIZATION_TICKS = {
  "1/4": 480,
  "1/8": 240,
  "1/16": 120,
  "1/32": 60,
} as const;

export type MidiStemCommand =
  | { type: "addNote"; note: MidiNoteV1 }
  | { type: "deleteNotes"; noteIds: readonly string[] }
  | {
      type: "moveNotes";
      noteIds: readonly string[];
      deltaTicks: number;
      deltaPitch: number;
    }
  | { type: "resizeNotes"; noteIds: readonly string[]; deltaTicks: number }
  | { type: "setVelocity"; noteIds: readonly string[]; velocity: number }
  | {
      type: "duplicateNotes";
      noteIds: readonly string[];
      copies: readonly MidiNoteV1[];
    }
  | {
      type: "quantizeNotes";
      noteIds: readonly string[];
      division: keyof typeof QUANTIZATION_TICKS;
    };

export type MidiCommandState = {
  durationTicks: number;
  notes: readonly MidiNoteV1[];
};

function selected(command: { noteIds: readonly string[] }) {
  return new Set(command.noteIds);
}

function canonical(notes: readonly MidiNoteV1[]) {
  const seen = new Set<string>();
  const parsed = notes.map((note) => midiNoteV1Schema.parse(note));
  parsed.forEach(({ noteId }) => {
    if (seen.has(noteId)) throw new Error("Duplicate noteId");
    seen.add(noteId);
  });
  return parsed.sort(
    (left, right) =>
      left.startTick - right.startTick ||
      left.pitch - right.pitch ||
      left.noteId.localeCompare(right.noteId),
  );
}

export function applyMidiStemCommand(
  state: MidiCommandState,
  command: MidiStemCommand,
): MidiCommandState {
  let notes: readonly MidiNoteV1[];
  switch (command.type) {
    case "addNote":
      notes = [...state.notes, command.note];
      break;
    case "deleteNotes": {
      const ids = selected(command);
      notes = state.notes.filter(({ noteId }) => !ids.has(noteId));
      break;
    }
    case "moveNotes": {
      if (
        !Number.isInteger(command.deltaTicks) ||
        !Number.isInteger(command.deltaPitch)
      ) {
        throw new TypeError("Note movement must use integer ticks and pitches");
      }
      const ids = selected(command);
      notes = state.notes.map((note) =>
        ids.has(note.noteId)
          ? {
              ...note,
              startTick: note.startTick + command.deltaTicks,
              pitch: note.pitch + command.deltaPitch,
            }
          : note,
      );
      break;
    }
    case "resizeNotes": {
      if (!Number.isInteger(command.deltaTicks))
        throw new TypeError("Resize must use integer ticks");
      const ids = selected(command);
      notes = state.notes.map((note) =>
        ids.has(note.noteId)
          ? { ...note, durationTicks: note.durationTicks + command.deltaTicks }
          : note,
      );
      break;
    }
    case "setVelocity": {
      const ids = selected(command);
      notes = state.notes.map((note) =>
        ids.has(note.noteId) ? { ...note, velocity: command.velocity } : note,
      );
      break;
    }
    case "duplicateNotes": {
      const ids = selected(command);
      if (command.copies.length !== ids.size)
        throw new Error("Each selected note needs one copy");
      notes = [...state.notes, ...command.copies];
      break;
    }
    case "quantizeNotes": {
      const ids = selected(command);
      const grid = QUANTIZATION_TICKS[command.division];
      notes = state.notes.map((note) =>
        ids.has(note.noteId)
          ? { ...note, startTick: Math.round(note.startTick / grid) * grid }
          : note,
      );
      break;
    }
  }

  const result = canonical(notes);
  if (
    result.some(
      (note) => note.startTick + note.durationTicks > state.durationTicks,
    )
  ) {
    throw new RangeError("Command would move a note outside the stem boundary");
  }
  return { ...state, notes: result };
}
