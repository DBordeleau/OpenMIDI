"use client";

import { useId } from "react";
import {
  INSTRUMENT_FAMILIES,
  INSTRUMENT_PRESETS_CATALOG_1,
  resolveCatalogPreset,
  type InstrumentFamily,
} from "./presets";

const FAMILY_LABELS: Record<InstrumentFamily, string> = {
  "drums-percussion": "Drums & percussion",
  basses: "Basses",
  keys: "Keys",
  leads: "Leads",
  "pads-strings": "Pads & strings",
  "plucks-bells-textures": "Plucks, bells & textures",
};

export type InstrumentPickerProps = {
  value: string;
  onChange: (presetId: string) => void;
  label?: string;
  disabled?: boolean;
};

export function InstrumentPicker({
  value,
  onChange,
  label = "Instrument",
  disabled = false,
}: InstrumentPickerProps) {
  const selectId = useId();
  const descriptionId = `${selectId}-description`;
  const selected = resolveCatalogPreset(value, 1);

  return (
    <div className="space-y-2">
      <label htmlFor={selectId} className="block font-semibold">
        {label}
      </label>
      <select
        id={selectId}
        value={value}
        disabled={disabled}
        aria-describedby={descriptionId}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="focus:border-accent border-strong bg-surface rounded-control min-h-11 w-full border px-3 py-2 transition-colors"
      >
        {INSTRUMENT_FAMILIES.map((family) => (
          <optgroup key={family} label={FAMILY_LABELS[family]}>
            {INSTRUMENT_PRESETS_CATALOG_1.filter(
              (preset) =>
                preset.family === family && preset.status === "active",
            ).map((preset) => (
              <option key={preset.presetId} value={preset.presetId}>
                {preset.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <p id={descriptionId} className="text-muted text-sm">
        {selected.description} Playable notes {selected.minNote}â€“
        {selected.maxNote}; up to {selected.maxPolyphony} simultaneous voices.
      </p>
    </div>
  );
}
