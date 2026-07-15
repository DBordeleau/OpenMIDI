import { describe, expect, it } from "vitest";
import { parseWebMidiMessage } from "./web-midi.client";

describe("Web MIDI message boundary", () => {
  it("parses channel note messages and treats velocity zero as note-off", () => {
    expect(parseWebMidiMessage([0x92, 60, 101], 42)).toEqual({
      type: "note-on",
      pitch: 60,
      velocity: 101,
      timestampMs: 42,
    });
    expect(parseWebMidiMessage([0x92, 60, 0], 84)?.type).toBe("note-off");
    expect(parseWebMidiMessage([0x82, 60, 50], 84)?.type).toBe("note-off");
  });

  it("ignores SysEx, controllers, malformed data, and invalid bytes", () => {
    expect(parseWebMidiMessage([0xf0, 1, 2], 0)).toBeNull();
    expect(parseWebMidiMessage([0xb0, 64, 127], 0)).toBeNull();
    expect(parseWebMidiMessage([0x90, 128, 64], 0)).toBeNull();
    expect(parseWebMidiMessage([0x90, 60], 0)).toBeNull();
  });
});
