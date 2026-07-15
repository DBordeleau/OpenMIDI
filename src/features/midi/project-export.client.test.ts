import { Midi } from "@tonejs/midi";
import { describe, expect, it } from "vitest";
import { MIDI_SINGLE_TRACK_FIXTURE } from "./fixtures";
import { exportMidiProject } from "./project-export.client";

describe("exportMidiProject", () => {
  it("creates deterministic independently parseable multitrack MIDI", () => {
    const { manifest, stemVersions } = MIDI_SINGLE_TRACK_FIXTURE;
    const first = exportMidiProject(manifest, stemVersions, "Export fixture");
    const second = exportMidiProject(manifest, stemVersions, "Export fixture");
    expect([...first]).toEqual([...second]);

    const parsed = new Midi(first);
    expect(parsed.header.ppq).toBe(480);
    expect(parsed.header.tempos[0]?.bpm).toBe(120);
    expect(parsed.tracks).toHaveLength(1);
    expect(parsed.tracks[0]?.name).toBe("MIDI track 1");
    expect(parsed.tracks[0]?.notes).toHaveLength(16);
  });
});
