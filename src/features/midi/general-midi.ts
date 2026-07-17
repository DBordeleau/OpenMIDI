import { resolveCatalogPreset, type InstrumentPresetV1 } from "./presets";

export type GeneralMidiPresetMapping = Pick<
  InstrumentPresetV1,
  "presetId" | "version" | "family"
> & {
  program: number;
  percussion: boolean;
};

const MELODIC_PROGRAM_PRESETS = [
  "warm-keys",
  "bell",
  "organ",
  "bright-pluck",
  "analog-bass",
  "string-pad",
  "choir-pad",
  "saw-lead",
  "soft-lead",
  "air-pad",
  "square-lead",
  "warm-pad",
  "glass-keys",
  "muted-pluck",
  "percussion-rack",
  "mallet",
] as const;

const PERCUSSION_PROGRAM_PRESETS = [
  "drum-machine",
  "lofi-kit",
  "electro-kit",
  "percussion-rack",
] as const;

export function mapGeneralMidiProgram(
  program: number,
  percussion = false,
): GeneralMidiPresetMapping {
  if (!Number.isInteger(program) || program < 0 || program > 127) {
    throw new RangeError(
      "General MIDI program must be an integer from 0 to 127",
    );
  }
  const presetId = percussion
    ? PERCUSSION_PROGRAM_PRESETS[Math.floor(program / 32)]
    : MELODIC_PROGRAM_PRESETS[Math.floor(program / 8)];
  const preset = resolveCatalogPreset(presetId, 1);
  return {
    program,
    percussion,
    presetId: preset.presetId,
    version: preset.version,
    family: preset.family,
  };
}
