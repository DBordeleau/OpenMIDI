import type { MidiLibraryReuseMode } from "./types";

export const MIDI_LIBRARY_RIGHTS_LABELS: Record<MidiLibraryReuseMode, string> =
  {
    commercial_reuse: "Commercial reuse permitted — CC BY 4.0",
    reference_only: "Reference only — reuse not granted",
  };

/**
 * Badge-length form for the browsing grid, where the full sentence ate the
 * card header. Both stay unambiguous — "CC BY 4.0" is the licence itself — and
 * every card still spells out what is and is not granted beneath the preview,
 * with the full statement on the listing page.
 */
export const MIDI_LIBRARY_RIGHTS_BADGES: Record<MidiLibraryReuseMode, string> =
  {
    commercial_reuse: "CC BY 4.0",
    reference_only: "Reference only",
  };
export function formatInstrumentFamily(value: string) {
  const labels: Record<string, string> = {
    "drums-percussion": "Drums & percussion",
    basses: "Basses",
    keys: "Keys",
    leads: "Leads",
    "pads-strings": "Pads & strings",
    "plucks-bells-textures": "Plucks, bells & textures",
  };
  return labels[value] ?? value;
}
export function formatPitch(pitch: number | null) {
  if (pitch === null) return "—";
  const names = [
    "C",
    "C♯",
    "D",
    "E♭",
    "E",
    "F",
    "F♯",
    "G",
    "A♭",
    "A",
    "B♭",
    "B",
  ];
  return `${names[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}
