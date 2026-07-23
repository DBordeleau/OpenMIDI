import { MIDI_PPQ } from "../manifest/v2";

export type MusicalTimeSignature = {
  numerator: number;
  denominator: number;
};

export function getBeatTicks(signature: MusicalTimeSignature) {
  return (MIDI_PPQ * 4) / signature.denominator;
}

export function getBarTicks(signature: MusicalTimeSignature) {
  return getBeatTicks(signature) * signature.numerator;
}

export function ticksToBars(ticks: number, signature: MusicalTimeSignature) {
  return ticks / getBarTicks(signature);
}

export function barsToTicks(bars: number, signature: MusicalTimeSignature) {
  return Math.max(1, Math.round(bars * getBarTicks(signature)));
}

export function formatBarsInput(
  ticks: number,
  signature: MusicalTimeSignature,
) {
  return Number(ticksToBars(ticks, signature).toFixed(4));
}

export function formatMusicalDuration(
  ticks: number,
  signature: MusicalTimeSignature,
) {
  const beatTicks = getBeatTicks(signature);
  const barTicks = getBarTicks(signature);
  const bars = Math.floor(ticks / barTicks);
  const afterBars = ticks - bars * barTicks;
  const beats = Math.floor(afterBars / beatTicks);
  const afterBeats = afterBars - beats * beatTicks;
  const parts: string[] = [];

  if (bars > 0) parts.push(`${bars} ${bars === 1 ? "bar" : "bars"}`);
  if (beats > 0) parts.push(`${beats} ${beats === 1 ? "beat" : "beats"}`);
  if (afterBeats > 0) {
    const fraction = afterBeats / beatTicks;
    const fractionLabel =
      fraction === 0.25
        ? "¼"
        : fraction === 0.5
          ? "½"
          : fraction === 0.75
            ? "¾"
            : `${Math.round(fraction * 100)}% of a`;
    parts.push(`${fractionLabel} beat`);
  }

  return parts.length > 0 ? parts.join(" · ") : "Less than ¼ beat";
}

export function formatMusicalPosition(
  tick: number,
  signature: MusicalTimeSignature,
) {
  const beatTicks = getBeatTicks(signature);
  const barTicks = getBarTicks(signature);
  const bar = Math.floor(tick / barTicks) + 1;
  const withinBar = tick % barTicks;
  const beat = Math.floor(withinBar / beatTicks) + 1;
  const beatFraction = (withinBar % beatTicks) / beatTicks;
  const fractionLabel =
    beatFraction === 0
      ? ""
      : beatFraction === 0.25
        ? " + ¼"
        : beatFraction === 0.5
          ? " + ½"
          : beatFraction === 0.75
            ? " + ¾"
            : ` + ${Math.round(beatFraction * 100)}%`;

  return `Bar ${bar} · Beat ${beat}${fractionLabel}`;
}
