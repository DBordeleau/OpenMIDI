import { describe, expect, it } from "vitest";
import {
  MAX_PROJECT_SYNTH_VOICES,
  resolveSynthPreset,
  SYNTH_PRESETS_V1,
} from "./presets";

describe("synth preset v1 registry", () => {
  it("freezes six melodic sounds and one synthesized drum kit", () => {
    expect(
      SYNTH_PRESETS_V1.filter(({ family }) => family === "melodic"),
    ).toHaveLength(6);
    expect(
      SYNTH_PRESETS_V1.filter(({ family }) => family === "drums"),
    ).toHaveLength(1);
    expect(new Set(SYNTH_PRESETS_V1.map(({ presetId }) => presetId)).size).toBe(
      7,
    );
    expect(
      SYNTH_PRESETS_V1.every(
        ({ maxPolyphony }) => maxPolyphony <= MAX_PROJECT_SYNTH_VOICES,
      ),
    ).toBe(true);
    expect(resolveSynthPreset("studio-drums", 1).drumMap).toEqual({
      "36": "Kick",
      "38": "Snare",
      "42": "Closed hat",
      "45": "Low tom",
      "47": "Mid tom",
      "48": "High tom",
    });
  });

  it("never substitutes an unknown or newer preset version", () => {
    expect(resolveSynthPreset("warm-poly", 1).name).toBe("Warm Poly");
    expect(() => resolveSynthPreset("warm-poly", 2)).toThrow(
      "Unsupported synth preset",
    );
  });
});
