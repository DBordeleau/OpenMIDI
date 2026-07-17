import { describe, expect, it } from "vitest";
import {
  MIDI_EIGHT_TRACK_FIXTURE,
  MIDI_MAX_SCHEDULE_FIXTURE,
  MIDI_SINGLE_TRACK_FIXTURE,
} from "./fixtures";
import { projectMidiSchedule } from "./scheduler";

describe("MIDI scheduler projection", () => {
  it.each([
    ["one track", MIDI_SINGLE_TRACK_FIXTURE, 16],
    ["eight tracks", MIDI_EIGHT_TRACK_FIXTURE, 2_000],
    ["maximum schedule", MIDI_MAX_SCHEDULE_FIXTURE, 16_384],
  ])("projects the %s fixture deterministically", (_name, fixture, count) => {
    const first = projectMidiSchedule(fixture);
    const second = projectMidiSchedule({
      ...fixture,
      stemVersions: new Map([...fixture.stemVersions].reverse()),
    });
    expect(first).toHaveLength(count);
    expect(second).toEqual(first);
  });

  it("applies mute and solo before scheduling", () => {
    const { manifest, stemVersions } = MIDI_EIGHT_TRACK_FIXTURE;
    const tracks = manifest.tracks.map((track, index) => ({
      ...track,
      muted: index === 0,
      soloed: index <= 1,
    }));
    const events = projectMidiSchedule({
      manifest: { ...manifest, tracks },
      stemVersions,
    });
    expect(new Set(events.map(({ trackId }) => trackId))).toEqual(
      new Set([tracks[1].trackId]),
    );
  });

  it("clips notes exactly at seek windows", () => {
    const events = projectMidiSchedule({
      ...MIDI_SINGLE_TRACK_FIXTURE,
      windowStartTick: 30,
      windowEndTick: 120,
    });
    expect(
      events.map(({ startTick, endTick }) => [startTick, endTick]),
    ).toEqual([
      [30, 48],
      [60, 108],
    ]);
  });

  it("loops source notes without duplicating event identities", () => {
    const { manifest, stemVersions } = MIDI_SINGLE_TRACK_FIXTURE;
    const track = manifest.tracks[0];
    if (track.kind !== "midi") throw new Error("Expected MIDI fixture track");
    const stem = [...stemVersions.values()][0];
    const looped = {
      ...manifest,
      durationTicks: stem.durationTicks * 2,
      tracks: [
        {
          ...track,
          clips: [
            {
              ...track.clips[0],
              durationTicks: stem.durationTicks * 2,
              loop: true,
            },
          ],
        },
      ],
    };
    const events = projectMidiSchedule({ manifest: looped, stemVersions });
    expect(events).toHaveLength(stem.notes.length * 2);
    expect(new Set(events.map(({ eventId }) => eventId)).size).toBe(
      events.length,
    );
  });
});
