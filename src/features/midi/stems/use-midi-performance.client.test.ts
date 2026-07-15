import { describe, expect, it } from "vitest";
import { qwertyPitch } from "./use-midi-performance.client";

describe("QWERTY piano mapping", () => {
  it("maps A through K chromatically from the selected octave", () => {
    expect(qwertyPitch("a", 4)).toBe(60);
    expect(qwertyPitch("w", 4)).toBe(61);
    expect(qwertyPitch("k", 4)).toBe(72);
    expect(qwertyPitch("z", 4)).toBeNull();
  });
});
