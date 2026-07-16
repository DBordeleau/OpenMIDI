import { describe, expect, it } from "vitest";
import { mapGeneralMidiProgram } from "./general-midi";

describe("General MIDI catalog mapping", () => {
  it("maps all 128 programs deterministically to active catalog presets", () => {
    const first = Array.from({ length: 128 }, (_, program) =>
      mapGeneralMidiProgram(program),
    );
    const second = Array.from({ length: 128 }, (_, program) =>
      mapGeneralMidiProgram(program),
    );
    expect(second).toEqual(first);
    expect(
      first
        .map(({ presetId }) => presetId)
        .filter((id, index, ids) => id !== ids[index - 1]),
    ).toEqual([
      "warm-keys",
      "bell",
      "organ",
      "bright-pluck",
      "analog-bass",
      "string-pad",
      "choir-pad",
      "saw-lead",
      "soft-lead",
      "air-pad",
      "square-lead",
      "warm-pad",
      "glass-keys",
      "muted-pluck",
      "percussion-rack",
      "mallet",
    ]);
  });

  it("maps channel-10 percussion independently of melodic programs", () => {
    expect(
      [0, 32, 64, 96].map(
        (program) => mapGeneralMidiProgram(program, true).presetId,
      ),
    ).toEqual(["drum-machine", "lofi-kit", "electro-kit", "percussion-rack"]);
  });

  it.each([-1, 1.5, 128])("rejects invalid program %s", (program) => {
    expect(() => mapGeneralMidiProgram(program)).toThrow("0 to 127");
  });
});
