import { describe, expect, it } from "vitest";
import {
  initialPianoScrollTop,
  midiPitchName,
  noteIntersectsPianoRollRectangle,
  pianoKeyFace,
  pianoKeyLabel,
  pianoRollSelectionRectangle,
  PIANO_KEY_WIDTH,
  PITCH_ROW_HEIGHT,
} from "./piano-roll";

describe("piano-roll spatial selection", () => {
  it("normalizes reverse drags and selects notes by tick/pitch intersection", () => {
    const rectangle = pianoRollSelectionRectangle(
      { tick: 480, pitch: 64 },
      { tick: 120, pitch: 60 },
    );
    expect(rectangle).toEqual({
      startTick: 120,
      endTick: 480,
      minPitch: 60,
      maxPitch: 64,
    });
    expect(
      noteIntersectsPianoRollRectangle(
        { startTick: 0, durationTicks: 120, pitch: 60 },
        rectangle,
      ),
    ).toBe(true);
    expect(
      noteIntersectsPianoRollRectangle(
        { startTick: 481, durationTicks: 120, pitch: 60 },
        rectangle,
      ),
    ).toBe(false);
    expect(
      noteIntersectsPianoRollRectangle(
        { startTick: 240, durationTicks: 120, pitch: 65 },
        rectangle,
      ),
    ).toBe(false);
  });
});

describe("piano-roll key presentation", () => {
  it("uses full white faces and shorter overlaid black faces", () => {
    expect(pianoKeyFace(60)).toEqual({
      x: 0,
      width: PIANO_KEY_WIDTH,
      insetY: 0,
    });
    expect(pianoKeyFace(61)).toEqual({
      x: PIANO_KEY_WIDTH * 0.36,
      width: PIANO_KEY_WIDTH * 0.64,
      insetY: 1,
    });
  });

  it("labels only C pitches in the roll gutter for every preset", () => {
    expect(pianoKeyLabel(60)).toBe("C4");
    expect(pianoKeyLabel(61)).toBeNull();
    expect(pianoKeyLabel(36)).toBe("C2");
    expect(pianoKeyLabel(37)).toBeNull();
    expect(midiPitchName(73)).toBe("C♯5");
  });
});

describe("initial piano-roll viewport", () => {
  it("centers middle C when it is in the selected sound range", () => {
    const viewportHeight = 10 * PITCH_ROW_HEIGHT;
    expect(
      initialPianoScrollTop({
        minPitch: 36,
        maxPitch: 96,
        viewportHeight,
      }),
    ).toBe((96 - 60) * PITCH_ROW_HEIGHT + PITCH_ROW_HEIGHT / 2 - 110);
  });

  it("clamps the target and scroll position for bounded ranges", () => {
    expect(
      initialPianoScrollTop({
        minPitch: 24,
        maxPitch: 60,
        viewportHeight: 220,
      }),
    ).toBe(0);
    expect(
      initialPianoScrollTop({
        minPitch: 72,
        maxPitch: 84,
        viewportHeight: 220,
      }),
    ).toBe(66);
  });
});
