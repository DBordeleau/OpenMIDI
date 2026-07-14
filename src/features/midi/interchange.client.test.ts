import { describe, expect, it } from "vitest";
import { MIDI_SINGLE_TRACK_FIXTURE } from "./fixtures";
import { exportMidiStemVersion, importMidiBytes } from "./interchange.client";

describe("bounded Standard MIDI interchange", () => {
  it("writes deterministic bytes and reads canonical note data", () => {
    const stem = [...MIDI_SINGLE_TRACK_FIXTURE.stemVersions.values()][0];
    const first = exportMidiStemVersion(stem, 120);
    const second = exportMidiStemVersion(stem, 120);
    expect(second).toEqual(first);
    expect(Array.from(first.slice(0, 4))).toEqual([0x4d, 0x54, 0x68, 0x64]);
    const imported = importMidiBytes(first);
    expect(imported.tempoBpm).toBe(120);
    expect(imported.notes).toEqual(
      stem.notes.map(({ pitch, velocity, startTick, durationTicks }) => ({
        pitch,
        velocity,
        startTick,
        durationTicks,
      })),
    );
  });

  it("rejects empty, oversized, malformed, and unsupported tempo-map files", () => {
    expect(() => importMidiBytes(new Uint8Array())).toThrow(
      "between 1 byte and 1 MiB",
    );
    expect(() => importMidiBytes(new Uint8Array(1_048_577))).toThrow(
      "between 1 byte and 1 MiB",
    );
    expect(() => importMidiBytes(new Uint8Array([1, 2, 3, 4]))).toThrow(
      "malformed",
    );
  });
});
