import { beforeEach, describe, expect, it, vi } from "vitest";
import { INSTRUMENT_PRESETS_CATALOG_1 } from "../presets";
import {
  createPresetVoice,
  getPresetRuntimeDefinition,
} from "./preset-voice.client";

const toneMock = vi.hoisted(() => {
  const disposals: string[] = [];
  const attacks: unknown[][] = [];
  const releases: unknown[][] = [];
  const ramps: unknown[][] = [];

  class Node {
    constructor(private readonly kind: string) {}
    connect() {
      return this;
    }
    toDestination() {
      return this;
    }
    dispose() {
      disposals.push(this.kind);
    }
  }

  class Panner extends Node {
    pan = { rampTo: (...args: unknown[]) => ramps.push(["pan", ...args]) };
    constructor(pan: number) {
      super("panner");
      void pan;
    }
  }

  class Gain extends Node {
    gain = { rampTo: (...args: unknown[]) => ramps.push(["gain", ...args]) };
    constructor(gain: number) {
      super("gain");
      void gain;
    }
  }

  class Limiter extends Node {
    constructor(threshold: number) {
      super("limiter");
      void threshold;
    }
  }

  class JCReverb extends Node {
    constructor(options: unknown) {
      super("reverb");
      void options;
    }
  }

  class FeedbackDelay extends Node {
    constructor(options: unknown) {
      super("delay");
      void options;
    }
  }

  class Chorus extends Node {
    constructor(options: unknown) {
      super("chorus");
      void options;
    }
    start() {
      return this;
    }
  }

  class Filter extends Node {
    constructor(options: unknown) {
      super("filter");
      void options;
    }
  }

  class PolySynth extends Node {
    maxPolyphony = 0;
    constructor(voice: unknown, options: unknown) {
      super("synth");
      void voice;
      void options;
    }
    triggerAttack(...args: unknown[]) {
      attacks.push(args);
    }
    triggerRelease(...args: unknown[]) {
      releases.push(args);
    }
    triggerAttackRelease(...args: unknown[]) {
      attacks.push(args);
    }
    releaseAll() {
      releases.push(["all"]);
    }
  }

  return {
    disposals,
    attacks,
    releases,
    ramps,
    module: {
      Panner,
      Gain,
      Limiter,
      JCReverb,
      FeedbackDelay,
      Chorus,
      Filter,
      PolySynth,
      Synth: class {},
      FMSynth: class {},
      AMSynth: class {},
      MembraneSynth: class {},
      dbToGain: (value: number) => value,
      Frequency: (value: number) => ({ toFrequency: () => value * 10 }),
    },
  };
});

vi.mock("tone", () => toneMock.module);

describe("catalog preset voices", () => {
  beforeEach(() => {
    toneMock.disposals.length = 0;
    toneMock.attacks.length = 0;
    toneMock.releases.length = 0;
    toneMock.ramps.length = 0;
  });

  it("covers every supported deterministic synthesis model", () => {
    expect(
      new Set(
        INSTRUMENT_PRESETS_CATALOG_1.map(
          (preset) => getPresetRuntimeDefinition(preset).voice,
        ),
      ),
    ).toEqual(new Set(["synth", "fm", "am", "membrane"]));
  });

  it("enforces bounds, schedules velocity, updates mixer, and disposes once", async () => {
    const voice = await createPresetVoice("saw-lead", 1, {
      gainDb: -2,
      pan: -0.25,
    });

    voice.triggerAttackRelease(60, 0.5, 1.25, 2);
    expect(toneMock.attacks[0]).toEqual([600, 0.5, 1.25, 1]);
    expect(() => voice.triggerAttack(20)).toThrow("outside");

    voice.setMixer({ gainDb: -4, pan: 0.5 });
    expect(toneMock.ramps).toEqual([
      ["gain", -10, 0.015],
      ["pan", 0.5, 0.015],
    ]);

    voice.allNotesOff();
    voice.dispose();
    voice.dispose();
    expect(toneMock.disposals.sort()).toEqual(
      [
        "chorus",
        "delay",
        "filter",
        "gain",
        "gain",
        "limiter",
        "panner",
        "reverb",
        "synth",
      ].sort(),
    );
    expect(() => voice.triggerAttack(60)).toThrow("disposed");
  });
});
