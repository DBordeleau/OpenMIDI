import { describe, expect, it } from "vitest";
import { MIDI_SINGLE_TRACK_FIXTURE } from "@/features/midi/fixtures";
import { projectMidiSchedule } from "@/features/midi/scheduler";
import { getMidiScheduleIdentity } from "./browser-midi-runtime.client";

describe("BrowserMidiRuntime schedule identity", () => {
  it("keeps mixer-only updates live while detecting structural schedule changes", () => {
    const events = projectMidiSchedule(MIDI_SINGLE_TRACK_FIXTURE);
    const withMixerChange = events.map((event) => ({
      ...event,
      gainDb: event.gainDb - 3,
      pan: 0.5,
    }));
    const withTimingChange = events.map((event, index) =>
      index === 0
        ? { ...event, startSeconds: event.startSeconds + 0.25 }
        : event,
    );

    expect(getMidiScheduleIdentity(withMixerChange)).toBe(
      getMidiScheduleIdentity(events),
    );
    expect(getMidiScheduleIdentity(withTimingChange)).not.toBe(
      getMidiScheduleIdentity(events),
    );
  });
});
