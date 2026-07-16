import { Midi } from "@tonejs/midi";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceManifestV3 } from "../manifest/v3";
import type { MidiStemVersion } from "@/features/midi/stems/types";
import { exportStudioMidiV3 } from "./local-export-v3.client";
import { importMidiBytes } from "@/features/midi/interchange.client";

describe("manifest-v3 local MIDI export", () => {
  it("exports multiple clips locally without requesting network media", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const patternId = "00000000-0000-4000-8000-000000000009";
    const manifest = {
      manifestVersion: 3,
      engine: "jam-session-midi",
      engineVersion: "jam-session-midi-3_tone-15.1.22_presets-1",
      projectId: "00000000-0000-4000-8000-000000000001",
      workspaceId: "00000000-0000-4000-8000-000000000002",
      tempoBpm: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      musicalKey: null,
      ppq: 480,
      durationTicks: 3840,
      tracks: [
        {
          trackId: "00000000-0000-4000-8000-000000000003",
          sortOrder: 0,
          name: "Keys",
          presetId: "warm-keys",
          presetVersion: 1,
          gainDb: 0,
          pan: 0,
          muted: false,
          soloed: false,
          clips: [0, 1920].map((startTick, index) => ({
            clipId: `00000000-0000-4000-8000-00000000000${4 + index}`,
            midiPatternVersionId: patternId,
            startTick,
            durationTicks: 1920,
            sourceStartTick: 0,
            loop: false,
          })),
        },
      ],
    } satisfies WorkspaceManifestV3;
    const pattern = {
      stemVersionId: patternId,
      stemId: "00000000-0000-4000-8000-000000000008",
      version: 1,
      name: "Keys",
      noteCount: 1,
      durationTicks: 1920,
      defaultPresetId: "warm-keys",
      defaultPresetVersion: 1,
      parentStemVersionId: null,
      creatorCreditName: "Producer",
      creatorId: "00000000-0000-4000-8000-000000000007",
      ppq: 480,
      notes: [
        {
          noteId: "00000000-0000-4000-8000-000000000006",
          startTick: 0,
          durationTicks: 480,
          pitch: 60,
          velocity: 100,
        },
      ],
      contentSha256: "a".repeat(64),
      createdAt: "2026-07-16T12:00:00.000Z",
    } satisfies MidiStemVersion;
    const bytes = exportStudioMidiV3(
      manifest,
      new Map([[patternId, pattern]]),
      "Two clips",
    );
    const midi = new Midi(bytes);
    expect(midi.tracks).toHaveLength(1);
    expect(midi.tracks[0]?.notes).toHaveLength(2);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("imports the exported Standard MIDI subset as structured notes", () => {
    const midi = new Midi();
    midi.header.setTempo(128);
    const track = midi.addTrack();
    track.instrument.number = 4;
    track.addNote({ midi: 64, ticks: 240, durationTicks: 480, velocity: 0.8 });

    const imported = importMidiBytes(midi.toArray());

    expect(imported.tempoBpm).toBe(128);
    expect(imported.notes).toEqual([
      expect.objectContaining({
        pitch: 64,
        startTick: 240,
        durationTicks: 480,
      }),
    ]);
    expect(imported.suggestedPreset.version).toBe(1);
  });
});
