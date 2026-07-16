import type { ResolvedSynthPreset, SynthesisParametersV1 } from "../presets";
import { resolveSynthPreset } from "../presets";

export type PresetVoice = {
  triggerAttack: (
    midiNote: number,
    whenSeconds?: number,
    velocity?: number,
  ) => void;
  triggerRelease: (midiNote: number, whenSeconds?: number) => void;
  triggerAttackRelease: (
    midiNote: number,
    durationSeconds: number,
    whenSeconds?: number,
    velocity?: number,
  ) => void;
  setMixer: (mixer: { gainDb: number; pan: number }) => void;
  allNotesOff: () => void;
  dispose: () => void;
};

export type PresetBenchmark = {
  presetId: string;
  renderMs: number;
  voices: number;
  peakDbfs: number;
};

export async function resumeMidiAudioContext() {
  const Tone = await import("tone");
  await Tone.start();
  return Tone.now();
}

export function watchMidiAudioContextSuspension(onSuspended: () => void) {
  let disposed = false;
  let cleanup = () => {};
  void import("tone").then((Tone) => {
    if (disposed) return;
    const context = Tone.getContext().rawContext;
    const stateChange = () => {
      if (context.state === "suspended" || context.state === "closed") {
        onSuspended();
      }
    };
    context.addEventListener("statechange", stateChange);
    cleanup = () => context.removeEventListener("statechange", stateChange);
  });
  return () => {
    disposed = true;
    cleanup();
  };
}

export async function createPresetVoice(
  presetId: string,
  version: number,
  mixer: { gainDb: number; pan: number } = { gainDb: 0, pan: 0 },
  engineVersion?: string,
): Promise<PresetVoice> {
  const preset = resolveSynthPreset(presetId, version, engineVersion);
  const parameters = getPresetRuntimeDefinition(preset);
  const Tone = await import("tone");
  const panner = new Tone.Panner(mixer.pan).toDestination();
  const outputSafety = new Tone.Gain(Tone.dbToGain(-6 + mixer.gainDb)).connect(
    panner,
  );
  const limiter = new Tone.Limiter(-3).connect(outputSafety);
  const gain = new Tone.Gain(Tone.dbToGain(parameters.gainDb)).connect(limiter);
  const reverb = new Tone.JCReverb({
    roomSize: 0.7,
    wet: parameters.reverbWet,
  }).connect(gain);
  const delay = new Tone.FeedbackDelay({
    delayTime: 0.18,
    feedback: 0.16,
    wet: parameters.delayWet,
  }).connect(reverb);
  const chorus = new Tone.Chorus({
    frequency: 1.2,
    delayTime: 2.5,
    depth: 0.25,
    wet: parameters.chorusWet,
  })
    .start()
    .connect(delay);
  const filter = new Tone.Filter({
    frequency: parameters.filterHz,
    Q: parameters.filterQ,
    type: "lowpass",
  }).connect(chorus);
  const synth = makeSynth(Tone, preset).connect(filter);
  synth.maxPolyphony = preset.maxPolyphony;

  let disposed = false;
  return {
    triggerAttack(midiNote, whenSeconds, velocity = 0.8) {
      if (disposed) throw new Error("Preset voice is disposed");
      if (midiNote < preset.minNote || midiNote > preset.maxNote) {
        throw new RangeError("Note is outside this preset's supported range");
      }
      synth.triggerAttack(
        Tone.Frequency(midiNote, "midi").toFrequency(),
        whenSeconds,
        Math.min(1, Math.max(0, velocity)),
      );
    },
    triggerRelease(midiNote, whenSeconds) {
      if (disposed) return;
      synth.triggerRelease(
        Tone.Frequency(midiNote, "midi").toFrequency(),
        whenSeconds,
      );
    },
    triggerAttackRelease(
      midiNote,
      durationSeconds,
      whenSeconds,
      velocity = 0.8,
    ) {
      if (disposed) throw new Error("Preset voice is disposed");
      if (midiNote < preset.minNote || midiNote > preset.maxNote) {
        throw new RangeError("Note is outside this preset's supported range");
      }
      synth.triggerAttackRelease(
        Tone.Frequency(midiNote, "midi").toFrequency(),
        durationSeconds,
        whenSeconds,
        Math.min(1, Math.max(0, velocity)),
      );
    },
    setMixer(nextMixer) {
      if (disposed) return;
      outputSafety.gain.rampTo(Tone.dbToGain(-6 + nextMixer.gainDb), 0.015);
      panner.pan.rampTo(nextMixer.pan, 0.015);
    },
    allNotesOff() {
      if (!disposed) synth.releaseAll();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      synth.releaseAll();
      synth.dispose();
      filter.dispose();
      chorus.dispose();
      delay.dispose();
      reverb.dispose();
      gain.dispose();
      limiter.dispose();
      outputSafety.dispose();
      panner.dispose();
    },
  };
}

export async function benchmarkPresetVoice(
  presetId: string,
  version: number,
  engineVersion?: string,
): Promise<PresetBenchmark> {
  const preset = resolveSynthPreset(presetId, version, engineVersion);
  const Tone = await import("tone");
  const voices: PresetVoice[] = [];
  const start = performance.now();
  let buffer: Awaited<ReturnType<typeof Tone.Offline>>;
  try {
    buffer = await Tone.Offline(async () => {
      const voice = await createPresetVoice(
        presetId,
        version,
        undefined,
        engineVersion,
      );
      voices.push(voice);
      for (let index = 0; index < preset.maxPolyphony; index += 1) {
        const note = Math.min(preset.maxNote, preset.minNote + (index % 12));
        voice.triggerAttackRelease(note, 0.35, 0.05, 0.85);
      }
    }, 1.25);
  } finally {
    voices.forEach((voice) => voice.dispose());
  }
  const renderMs = performance.now() - start;
  const samples = buffer.getChannelData(0);
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  return {
    presetId,
    renderMs,
    voices: preset.maxPolyphony,
    peakDbfs: peak === 0 ? Number.NEGATIVE_INFINITY : 20 * Math.log10(peak),
  };
}

type ToneModule = typeof import("tone");

export function getPresetRuntimeDefinition(
  preset: ResolvedSynthPreset,
): SynthesisParametersV1 {
  if ("parameters" in preset) return preset.parameters;
  return {
    voice: preset.family === "drums" ? "membrane" : "synth",
    oscillator: preset.oscillator,
    envelope: preset.envelope,
    harmonicity: 1,
    modulationIndex: 2,
    filterHz: preset.filterHz,
    filterQ: preset.filterQ,
    chorusWet: preset.chorusWet,
    delayWet: preset.delayWet,
    reverbWet: preset.reverbWet,
    gainDb: preset.gainDb,
  };
}

function makeSynth(Tone: ToneModule, preset: ResolvedSynthPreset) {
  const parameters = getPresetRuntimeDefinition(preset);
  if (parameters.voice === "membrane") {
    return new Tone.PolySynth(Tone.MembraneSynth, {
      envelope: parameters.envelope,
      oscillator: { type: parameters.oscillator },
      pitchDecay: 0.04,
      octaves: 4,
    });
  }
  if (parameters.voice === "fm") {
    return new Tone.PolySynth(Tone.FMSynth, {
      envelope: parameters.envelope,
      oscillator: { type: parameters.oscillator },
      harmonicity: parameters.harmonicity,
      modulationIndex: parameters.modulationIndex,
    });
  }
  if (parameters.voice === "am") {
    return new Tone.PolySynth(Tone.AMSynth, {
      envelope: parameters.envelope,
      oscillator: { type: parameters.oscillator },
      harmonicity: parameters.harmonicity,
    });
  }
  return new Tone.PolySynth(Tone.Synth, {
    envelope: parameters.envelope,
    oscillator: { type: parameters.oscillator },
  });
}
