import { Midi } from "@tonejs/midi";
import { describe, expect, it, vi } from "vitest";
import { MIDI_SINGLE_TRACK_FIXTURE } from "./fixtures";
import {
  encodePcm16Wav,
  exportMidiProject,
  renderMidiProjectWav,
} from "./project-export.client";

const renderMock = vi.hoisted(() => ({
  create: vi.fn(async () => ({
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
    triggerAttackRelease: vi.fn(),
    setMixer: vi.fn(),
    allNotesOff: vi.fn(),
    dispose: vi.fn(),
  })),
  trigger: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock("./browser-engine/preset-voice.client", () => ({
  createPresetVoice: renderMock.create.mockImplementation(async () => ({
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
    triggerAttackRelease: renderMock.trigger,
    setMixer: vi.fn(),
    allNotesOff: vi.fn(),
    dispose: renderMock.dispose,
  })),
}));

vi.mock("tone", () => ({
  getContext: () => ({ rawContext: { decodeAudioData: vi.fn() } }),
  Offline: async (callback: () => Promise<void>) => {
    await callback();
    return {
      getChannelData: (channel: number) =>
        channel === 0
          ? new Float32Array([0, 0.5, -0.5])
          : new Float32Array([0, -0.25, 0.25]),
    };
  },
  Panner: class {},
  Gain: class {},
  Player: class {},
  dbToGain: (value: number) => value,
}));

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

  it("renders a browser-local PCM WAV and disposes scheduled voices", async () => {
    renderMock.create.mockClear();
    renderMock.trigger.mockClear();
    renderMock.dispose.mockClear();
    const { manifest, stemVersions } = MIDI_SINGLE_TRACK_FIXTURE;

    const wav = await renderMidiProjectWav(manifest, stemVersions);
    const bytes = new Uint8Array(await wav.arrayBuffer());

    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe("WAVE");
    expect(wav.type).toBe("audio/wav");
    expect(renderMock.trigger).toHaveBeenCalledTimes(16);
    expect(renderMock.dispose).toHaveBeenCalledTimes(1);
  });

  it("can resolve presets against an authoritative engine override", async () => {
    renderMock.create.mockClear();
    const { manifest, stemVersions } = MIDI_SINGLE_TRACK_FIXTURE;

    await renderMidiProjectWav(
      manifest,
      stemVersions,
      "jam-session-midi-3_tone-15.1.22_presets-1",
    );

    expect(renderMock.create).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Number),
      expect.any(Object),
      "jam-session-midi-3_tone-15.1.22_presets-1",
    );
  });

  it("encodes equal-length channels and clamps samples to PCM16", async () => {
    const wav = encodePcm16Wav(
      [new Float32Array([-2, 0, 2]), new Float32Array([1, -1, 0.5])],
      44_100,
    );
    const view = new DataView(await wav.arrayBuffer());
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(44_100);
    expect(view.getInt16(44, true)).toBe(-32_768);
    expect(view.getInt16(46, true)).toBe(32_767);
    expect(() =>
      encodePcm16Wav([new Float32Array(1), new Float32Array(2)], 44_100),
    ).toThrow("equal frame counts");
  });
});
