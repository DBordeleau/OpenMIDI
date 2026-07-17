import { Midi } from "@tonejs/midi";
import { describe, expect, it } from "vitest";
import { MIDI_SINGLE_TRACK_FIXTURE } from "./fixtures";
import { exportMidiStemVersion, importMidiBytes } from "./interchange.client";

function readIndependentMidiStructure(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number, length: number) =>
    String.fromCharCode(...bytes.slice(offset, offset + length));
  expect(text(0, 4)).toBe("MThd");
  const headerLength = view.getUint32(4);
  const format = view.getUint16(8);
  const trackCount = view.getUint16(10);
  const ppq = view.getUint16(12);
  let offset = 8 + headerLength;
  const trackNames: string[] = [];
  const noteOns: { pitch: number; velocity: number }[] = [];
  for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
    expect(text(offset, 4)).toBe("MTrk");
    const end = offset + 8 + view.getUint32(offset + 4);
    offset += 8;
    let runningStatus = 0;
    while (offset < end) {
      do {
        const byte = bytes[offset++];
        if ((byte & 0x80) === 0) break;
      } while (offset < end);
      let status = bytes[offset++];
      if ((status & 0x80) === 0) {
        offset -= 1;
        status = runningStatus;
      } else if (status < 0xf0) {
        runningStatus = status;
      }
      if (status === 0xff) {
        const type = bytes[offset++];
        let length = 0;
        let lengthByte: number;
        do {
          lengthByte = bytes[offset++];
          length = (length << 7) | (lengthByte & 0x7f);
        } while (lengthByte & 0x80);
        if (type === 0x03) trackNames.push(text(offset, length));
        offset += length;
      } else if (status === 0xf0 || status === 0xf7) {
        let length = 0;
        let lengthByte: number;
        do {
          lengthByte = bytes[offset++];
          length = (length << 7) | (lengthByte & 0x7f);
        } while (lengthByte & 0x80);
        offset += length;
      } else {
        const message = status & 0xf0;
        const first = bytes[offset++];
        if (message === 0xc0 || message === 0xd0) continue;
        const second = bytes[offset++];
        if (message === 0x90 && second > 0) {
          noteOns.push({ pitch: first, velocity: second });
        }
      }
    }
  }
  return { format, trackCount, ppq, trackNames, noteOns };
}

describe("bounded Standard MIDI interchange", () => {
  it("writes deterministic bytes and reads canonical note data", () => {
    const stem = [...MIDI_SINGLE_TRACK_FIXTURE.stemVersions.values()][0];
    const first = exportMidiStemVersion(stem, 120, "Fixture Artist");
    const second = exportMidiStemVersion(stem, 120, "Fixture Artist");
    expect(second).toEqual(first);
    expect(Array.from(first.slice(0, 4))).toEqual([0x4d, 0x54, 0x68, 0x64]);
    const independent = readIndependentMidiStructure(first);
    expect(independent).toMatchObject({
      format: 1,
      trackCount: 2,
      ppq: 480,
      trackNames: expect.arrayContaining([stem.name]),
    });
    expect(independent.noteOns).toEqual(
      stem.notes.map(({ pitch, velocity }) => ({ pitch, velocity })),
    );
    const imported = importMidiBytes(first);
    expect(imported.tempoBpm).toBe(120);
    expect(imported.suggestedPreset).toMatchObject({
      presetId: "warm-keys",
      version: 1,
      program: 0,
    });
    expect(imported.warnings).toContain(
      "Ignored 1 unsupported text or attribution event.",
    );
    expect(imported.notes).toEqual(
      stem.notes.map(({ pitch, velocity, startTick, durationTicks }) => ({
        pitch,
        velocity,
        startTick,
        durationTicks,
      })),
    );
  });

  it("maps imported melodic and channel-10 programs without fetching timbres", () => {
    const midi = new Midi();
    midi.header.setTempo(120);
    const bass = midi.addTrack();
    bass.name = "Bass";
    bass.instrument.number = 38;
    bass.addNote({ midi: 40, ticks: 0, durationTicks: 120, velocity: 0.8 });
    const drums = midi.addTrack();
    drums.name = "Drums";
    drums.channel = 9;
    drums.instrument.number = 0;
    drums.addNote({ midi: 36, ticks: 0, durationTicks: 60, velocity: 1 });

    const imported = importMidiBytes(midi.toArray());

    expect(imported.instrumentMappings).toEqual([
      expect.objectContaining({ trackName: "Bass", presetId: "analog-bass" }),
      expect.objectContaining({ trackName: "Drums", presetId: "drum-machine" }),
    ]);
    expect(imported.warnings).toContain(
      "Mapped General MIDI programs to the closest Jam Session instrument families.",
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
