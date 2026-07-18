import { Midi } from "@tonejs/midi";
import { describe, expect, it } from "vitest";
import { exportMidiLibraryPattern } from "./library-export.client";

describe("browser-local library MIDI export", () => {
  it("embeds exact source, CC BY terms, creator, and inherited external credit", () => {
    const bytes = exportMidiLibraryPattern({
      listingId: "10000000-0000-4000-8000-000000000001",
      midiPatternId: "10000000-0000-4000-8000-000000000002",
      midiPatternVersionId: "10000000-0000-4000-8000-000000000003",
      title: "Gold pulse",
      creatorCreditName: "Pattern Maker",
      license: {
        code: "CC-BY-4.0",
        version: "4.0",
        url: "https://creativecommons.org/licenses/by/4.0/",
      },
      externalCredits: [{ creditedName: "Outside Writer", role: "Composer" }],
      ppq: 480,
      durationTicks: 960,
      presetId: "warm-keys",
      presetVersion: 1,
      notes: [
        {
          noteId: "10000000-0000-4000-8000-000000000004",
          startTick: 0,
          durationTicks: 240,
          pitch: 60,
          velocity: 100,
        },
      ],
    });
    const midi = new Midi(bytes);
    const metadata = midi.header.meta.map(({ text }) => text).join("\n");
    expect(metadata).toContain("Pattern Maker");
    expect(metadata).toContain("CC BY 4.0");
    expect(metadata).toContain("10000000-0000-4000-8000-000000000003");
    expect(metadata).toContain("Outside Writer");
    expect(midi.tracks[0]?.notes).toHaveLength(1);
  });
});
