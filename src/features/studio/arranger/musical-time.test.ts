import { describe, expect, it } from "vitest";
import {
  barsToTicks,
  formatBarsInput,
  formatMusicalDuration,
  formatMusicalPosition,
  getBarTicks,
  getBeatTicks,
} from "./musical-time";

describe("arranger musical time", () => {
  it("converts bars and beats using the project time signature", () => {
    const signature = { numerator: 3, denominator: 4 };

    expect(getBeatTicks(signature)).toBe(480);
    expect(getBarTicks(signature)).toBe(1_440);
    expect(barsToTicks(2.5, signature)).toBe(3_600);
    expect(formatBarsInput(3_600, signature)).toBe(2.5);
  });

  it("formats clip durations without exposing storage ticks", () => {
    const signature = { numerator: 4, denominator: 4 };

    expect(formatMusicalDuration(1_920, signature)).toBe("1 bar");
    expect(formatMusicalDuration(3_120, signature)).toBe(
      "1 bar · 2 beats · ½ beat",
    );
    expect(formatMusicalDuration(120, signature)).toBe("¼ beat");
  });

  it("formats one-based musical positions with sub-beat detail", () => {
    const signature = { numerator: 4, denominator: 4 };

    expect(formatMusicalPosition(0, signature)).toBe("Bar 1 · Beat 1");
    expect(formatMusicalPosition(2_640, signature)).toBe("Bar 2 · Beat 2 + ½");
  });
});
