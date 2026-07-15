import { describe, expect, it } from "vitest";
import {
  getRulerMarks,
  millisecondsToTicks,
  pixelsToTicks,
  ticksToMilliseconds,
  ticksToPixels,
} from "./timeline";

describe("arranger timeline math", () => {
  it("aligns ticks, milliseconds, and pixels at representative tempos and zooms", () => {
    expect(millisecondsToTicks(500, 120)).toBe(480);
    expect(ticksToMilliseconds(480, 120)).toBe(500);
    expect(millisecondsToTicks(333, 90)).toBe(240);

    for (const pixelsPerQuarter of [48, 96, 192]) {
      const scale = { tempoBpm: 120, pixelsPerQuarter };
      expect(ticksToPixels(960, scale)).toBe(pixelsPerQuarter * 2);
      expect(pixelsToTicks(pixelsPerQuarter * 2, scale)).toBe(960);
      expect(pixelsToTicks(ticksToPixels(1, scale), scale)).toBe(1);
    }
  });

  it("places deterministic bar and beat boundaries for non-4/4 projects", () => {
    expect(
      getRulerMarks({ durationTicks: 2_880, numerator: 3, denominator: 4 }),
    ).toEqual([
      { tick: 0, bar: 1, beat: 1 },
      { tick: 480, bar: 1, beat: 2 },
      { tick: 960, bar: 1, beat: 3 },
      { tick: 1_440, bar: 2, beat: 1 },
      { tick: 1_920, bar: 2, beat: 2 },
      { tick: 2_400, bar: 2, beat: 3 },
      { tick: 2_880, bar: 3, beat: 1 },
    ]);
  });
});
