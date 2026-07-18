"use client";

import { Midi } from "@tonejs/midi";
import type { MidiLibraryExport } from "./types";

export function exportMidiLibraryPattern(source: MidiLibraryExport) {
  const midi = new Midi();
  const creditLines = source.externalCredits.map(
    (credit) =>
      `${credit.role}: ${credit.creditedName}${credit.workTitle ? ` — ${credit.workTitle}` : ""}`,
  );
  midi.header.fromJSON({
    name: source.title,
    ppq: source.ppq,
    tempos: [{ bpm: 120, ticks: 0 }],
    timeSignatures: [{ ticks: 0, timeSignature: [4, 4] }],
    keySignatures: [],
    meta: [
      `OpenMIDI creator: ${source.creatorCreditName}`,
      `License: CC BY 4.0 — ${source.license.url}`,
      `Source listing: ${source.listingId}`,
      `Exact pattern version: ${source.midiPatternVersionId}`,
      ...creditLines,
    ].map((text) => ({ ticks: 0, type: "text" as const, text })),
  });
  const track = midi.addTrack();
  track.name = source.title;
  for (const note of source.notes)
    track.addNote({
      midi: note.pitch,
      velocity: note.velocity / 127,
      ticks: note.startTick,
      durationTicks: note.durationTicks,
    });
  track.endOfTrackTicks = source.durationTicks;
  return midi.toArray();
}
