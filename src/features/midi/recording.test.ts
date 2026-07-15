import { describe, expect, it } from "vitest";
import {
  finishMidiRecording,
  performanceTimestampToTick,
  recordMidiNoteOff,
  recordMidiNoteOn,
  startMidiRecording,
} from "./recording";

describe("MIDI performance recording", () => {
  it("maps monotonic event timestamps to transport ticks", () => {
    expect(
      performanceTimestampToTick({
        timestampMs: 1_500,
        startTimestampMs: 1_000,
        bpm: 120,
        ppq: 480,
      }),
    ).toBe(480);
  });

  it("closes note-on/off pairs with hardware velocity", () => {
    let take = startMidiRecording({
      bpm: 120,
      ppq: 480,
      durationTicks: 1_920,
      startTimestampMs: 1_000,
    });
    take = recordMidiNoteOn(take, {
      pitch: 64,
      velocity: 117,
      timestampMs: 1_250,
      noteId: "10000000-0000-4000-8000-000000000001",
    });
    take = recordMidiNoteOff(take, { pitch: 64, timestampMs: 1_750 });
    expect(take.activeNotes.size).toBe(0);
    expect(take.notes).toEqual([
      {
        noteId: "10000000-0000-4000-8000-000000000001",
        pitch: 64,
        velocity: 117,
        startTick: 240,
        durationTicks: 480,
      },
    ]);
  });

  it("closes outstanding and repeated notes without zero durations", () => {
    let take = startMidiRecording({
      bpm: 120,
      ppq: 480,
      durationTicks: 960,
      startTimestampMs: 0,
    });
    take = recordMidiNoteOn(take, {
      pitch: 60,
      velocity: 90,
      timestampMs: 100,
      noteId: "10000000-0000-4000-8000-000000000001",
    });
    take = recordMidiNoteOn(take, {
      pitch: 60,
      velocity: 96,
      timestampMs: 100,
      noteId: "10000000-0000-4000-8000-000000000002",
    });
    expect(finishMidiRecording(take, 4_000)).toEqual([
      expect.objectContaining({ durationTicks: 1 }),
      expect.objectContaining({ durationTicks: 864 }),
    ]);
  });
});
