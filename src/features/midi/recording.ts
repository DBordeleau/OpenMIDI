import { canonicalizeMidiNotes } from "@/features/studio/manifest/v2";
import type { MidiNoteV1 } from "@/features/studio/manifest/v2";

type ActiveRecordedNote = {
  noteId: string;
  pitch: number;
  velocity: number;
  startTick: number;
};

export type MidiRecordingTake = {
  bpm: number;
  ppq: number;
  durationTicks: number;
  startTimestampMs: number;
  activeNotes: ReadonlyMap<number, ActiveRecordedNote>;
  notes: readonly MidiNoteV1[];
};

export function performanceTimestampToTick(input: {
  timestampMs: number;
  startTimestampMs: number;
  bpm: number;
  ppq: number;
}) {
  const elapsedSeconds = Math.max(
    0,
    (input.timestampMs - input.startTimestampMs) / 1_000,
  );
  return Math.round((elapsedSeconds * input.bpm * input.ppq) / 60);
}

export function startMidiRecording(input: {
  bpm: number;
  ppq: number;
  durationTicks: number;
  startTimestampMs: number;
}): MidiRecordingTake {
  if (
    !Number.isFinite(input.startTimestampMs) ||
    !Number.isFinite(input.bpm) ||
    input.bpm <= 0 ||
    !Number.isInteger(input.ppq) ||
    input.ppq <= 0 ||
    !Number.isInteger(input.durationTicks) ||
    input.durationTicks <= 0
  ) {
    throw new RangeError("Invalid MIDI recording transport");
  }
  return { ...input, activeNotes: new Map(), notes: [] };
}

export function recordMidiNoteOn(
  take: MidiRecordingTake,
  input: {
    pitch: number;
    velocity: number;
    timestampMs: number;
    noteId: string;
  },
): MidiRecordingTake {
  if (
    !Number.isInteger(input.pitch) ||
    input.pitch < 0 ||
    input.pitch > 127 ||
    !Number.isInteger(input.velocity) ||
    input.velocity < 1 ||
    input.velocity > 127
  ) {
    return take;
  }
  let next = take.activeNotes.has(input.pitch)
    ? recordMidiNoteOff(take, {
        pitch: input.pitch,
        timestampMs: input.timestampMs,
      })
    : take;
  const startTick = performanceTimestampToTick({
    ...next,
    timestampMs: input.timestampMs,
  });
  if (startTick >= next.durationTicks) return next;
  const activeNotes = new Map(next.activeNotes);
  activeNotes.set(input.pitch, {
    noteId: input.noteId,
    pitch: input.pitch,
    velocity: input.velocity,
    startTick,
  });
  next = { ...next, activeNotes };
  return next;
}

export function recordMidiNoteOff(
  take: MidiRecordingTake,
  input: { pitch: number; timestampMs: number },
): MidiRecordingTake {
  const active = take.activeNotes.get(input.pitch);
  if (!active) return take;
  const endTick = Math.min(
    take.durationTicks,
    performanceTimestampToTick({ ...take, timestampMs: input.timestampMs }),
  );
  const activeNotes = new Map(take.activeNotes);
  activeNotes.delete(input.pitch);
  return {
    ...take,
    activeNotes,
    notes: canonicalizeMidiNotes([
      ...take.notes,
      {
        noteId: active.noteId,
        pitch: active.pitch,
        velocity: active.velocity,
        startTick: active.startTick,
        durationTicks: Math.max(1, endTick - active.startTick),
      },
    ]),
  };
}

export function finishMidiRecording(
  take: MidiRecordingTake,
  timestampMs: number,
): readonly MidiNoteV1[] {
  let finished = take;
  for (const pitch of take.activeNotes.keys()) {
    finished = recordMidiNoteOff(finished, { pitch, timestampMs });
  }
  return canonicalizeMidiNotes(finished.notes);
}
