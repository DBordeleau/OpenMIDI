import { describe, expect, it } from "vitest";
import {
  INSTRUMENT_FAMILIES,
  INSTRUMENT_PRESETS_CATALOG_1,
  LEGACY_MIDI_ENGINE_VERSION,
  MAX_PROJECT_SYNTH_VOICES,
  MIDI_ENGINE_VERSION,
  resolveCatalogPreset,
  resolveSynthPreset,
  SYNTH_PRESETS_V1,
} from "./presets";

const EXPECTED_IDS = [
  "drum-machine",
  "electro-kit",
  "lofi-kit",
  "percussion-rack",
  "sub-bass",
  "analog-bass",
  "fm-bass",
  "pluck-bass",
  "warm-keys",
  "electric-keys",
  "organ",
  "glass-keys",
  "saw-lead",
  "square-lead",
  "fm-lead",
  "soft-lead",
  "warm-pad",
  "air-pad",
  "string-pad",
  "choir-pad",
  "muted-pluck",
  "bright-pluck",
  "bell",
  "mallet",
] as const;

describe("instrument preset catalog 1", () => {
  it("freezes exactly the contracted 24 IDs across six families", () => {
    expect(
      INSTRUMENT_PRESETS_CATALOG_1.map(({ presetId }) => presetId),
    ).toEqual(EXPECTED_IDS);
    expect(
      new Set(INSTRUMENT_PRESETS_CATALOG_1.map(({ family }) => family)),
    ).toEqual(new Set(INSTRUMENT_FAMILIES));
    expect(INSTRUMENT_PRESETS_CATALOG_1).toHaveLength(24);
  });

  it("exposes complete immutable version and synthesis metadata", () => {
    for (const preset of INSTRUMENT_PRESETS_CATALOG_1) {
      expect(preset).toMatchObject({
        catalogVersion: 1,
        version: 1,
        engineVersion: MIDI_ENGINE_VERSION,
        status: "active",
        parameterSchema: { schemaVersion: 1 },
      });
      expect(preset.minNote).toBeLessThanOrEqual(preset.maxNote);
      expect(preset.maxPolyphony).toBeLessThanOrEqual(MAX_PROJECT_SYNTH_VOICES);
      expect(Object.isFrozen(preset)).toBe(true);
      expect(Object.isFrozen(preset.parameters.envelope)).toBe(true);
      expect(Object.isFrozen(preset.parameterSchema.fields)).toBe(true);
    }
  });

  it("keeps GM drum labels and refuses implicit version substitution", () => {
    expect(resolveCatalogPreset("drum-machine", 1).drumMap).toMatchObject({
      "36": "Bass drum",
      "38": "Acoustic snare",
      "42": "Closed hi-hat",
      "46": "Open hi-hat",
    });
    expect(() => resolveCatalogPreset("warm-keys", 2)).toThrow(
      "Unsupported catalog preset",
    );
  });

  it("retains the seven transitional v1 definitions outside catalog 1", () => {
    expect(SYNTH_PRESETS_V1).toHaveLength(7);
    expect(resolveSynthPreset("warm-poly", 1).name).toBe("Warm Poly");
    expect(resolveSynthPreset("warm-keys", 1).name).toBe("Warm Keys");
    expect(() => resolveSynthPreset("warm-poly", 2)).toThrow(
      "Unsupported synth preset",
    );
  });

  it("keeps the overlapping glass-keys version engine scoped", () => {
    const legacy = resolveSynthPreset(
      "glass-keys",
      1,
      LEGACY_MIDI_ENGINE_VERSION,
    );
    const catalog = resolveSynthPreset("glass-keys", 1, MIDI_ENGINE_VERSION);
    expect(legacy).toMatchObject({ oscillator: "sine", gainDb: -9 });
    expect(catalog).toMatchObject({
      family: "keys",
      parameters: { voice: "fm", gainDb: -15 },
    });
    expect(resolveSynthPreset("glass-keys", 1)).toBe(legacy);
  });
});
