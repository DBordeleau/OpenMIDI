import { MIDI_V3_PPQ } from "@/features/midi/domain-v3";
import type { InstrumentFamily } from "@/features/midi/presets";

export const SILHOUETTE_COLUMNS = 64;
export const SILHOUETTE_BANDS = 8;
const CANONICAL_SILHOUETTE_PATTERN = /^[A-Za-z0-9+/]{86}==$/;

export type ArrangementMapClip = {
  clipId: string;
  midiPatternVersionId: string;
  startTick: number;
  durationTicks: number;
  loop: boolean;
};

export type ArrangementMapTrack = {
  id: string;
  name: string;
  sortOrder: number;
  presetName: string;
  family: InstrumentFamily;
  clips: ArrangementMapClip[];
};

/**
 * One hue per instrument family, so a glance at the map tells you which layer is
 * carrying the arrangement. The three warm values are the brand's own; the mint
 * and lilac exist because six families need six separable hues and the palette
 * only holds three — they are used nowhere else and stay desaturated enough not
 * to fight the accent.
 */
export const FAMILY_COLORS: Record<InstrumentFamily, string> = {
  keys: "#ff8d63",
  basses: "#ffc879",
  "drums-percussion": "#e77aa6",
  "pads-strings": "#8fd0c4",
  leads: "#ffa9d0",
  "plucks-bells-textures": "#b9a7ff",
};

/**
 * A silhouette is 64 bytes — one per time column — whose bits mark which of 8
 * pitch bands the pattern occupies there (bit 0 is the lowest band). Returns
 * null for anything that is not the canonical encoding, because a clip with no
 * silhouette renders as flat colour and that is a valid, expected state.
 */
export function decodePatternSilhouette(encoded: string): Uint8Array | null {
  if (!CANONICAL_SILHOUETTE_PATTERN.test(encoded)) return null;
  try {
    const binary = atob(encoded);
    if (binary.length !== SILHOUETTE_COLUMNS) return null;
    const columns = new Uint8Array(SILHOUETTE_COLUMNS);
    for (let index = 0; index < SILHOUETTE_COLUMNS; index += 1) {
      columns[index] = binary.charCodeAt(index) & 0xff;
    }
    return columns;
  } catch {
    return null;
  }
}

/** The arrangement's own length: where the last clip stops, not the tempo map. */
export function arrangementTotalTicks(tracks: ArrangementMapTrack[]) {
  let total = 0;
  for (const track of tracks) {
    for (const clip of track.clips) {
      total = Math.max(total, clip.startTick + clip.durationTicks);
    }
  }
  return total;
}

export function ticksPerBar(
  timeSignature: {
    numerator: number;
    denominator: number;
  } | null,
) {
  if (!timeSignature) return MIDI_V3_PPQ * 4;
  return Math.max(
    Math.round(
      (MIDI_V3_PPQ * 4 * timeSignature.numerator) / timeSignature.denominator,
    ),
    1,
  );
}

export function countClips(tracks: ArrangementMapTrack[]) {
  return tracks.reduce((total, track) => total + track.clips.length, 0);
}
