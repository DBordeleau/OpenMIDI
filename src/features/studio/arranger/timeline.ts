import { MIDI_PPQ } from "../manifest/v2";

export const DEFAULT_PIXELS_PER_QUARTER = 96;
export const MIN_PIXELS_PER_QUARTER = 48;
export const MAX_PIXELS_PER_QUARTER = 192;

export type TimelineScale = {
  tempoBpm: number;
  pixelsPerQuarter: number;
};

export function ticksToPixels(ticks: number, scale: TimelineScale) {
  return (ticks / MIDI_PPQ) * scale.pixelsPerQuarter;
}

export function pixelsToTicks(pixels: number, scale: TimelineScale) {
  return Math.round((pixels / scale.pixelsPerQuarter) * MIDI_PPQ);
}

export function millisecondsToTicks(milliseconds: number, tempoBpm: number) {
  return Math.round((milliseconds * tempoBpm * MIDI_PPQ) / 60_000);
}

export function ticksToMilliseconds(ticks: number, tempoBpm: number) {
  return Math.round((ticks * 60_000) / (tempoBpm * MIDI_PPQ));
}

export function clampZoom(pixelsPerQuarter: number) {
  return Math.min(
    MAX_PIXELS_PER_QUARTER,
    Math.max(MIN_PIXELS_PER_QUARTER, pixelsPerQuarter),
  );
}

export function getRulerMarks(input: {
  durationTicks: number;
  numerator: number;
  denominator: number;
}) {
  const beatTicks = (MIDI_PPQ * 4) / input.denominator;
  const marks: Array<{ tick: number; bar: number; beat: number }> = [];
  for (
    let tick = 0, index = 0;
    tick <= input.durationTicks;
    tick += beatTicks, index += 1
  ) {
    marks.push({
      tick,
      bar: Math.floor(index / input.numerator) + 1,
      beat: (index % input.numerator) + 1,
    });
  }
  return marks;
}
