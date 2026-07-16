import { z } from "zod";

export const MAX_PROJECT_SYNTH_VOICES = 32;

const envelopeSchema = z
  .object({
    attack: z.number().nonnegative(),
    decay: z.number().nonnegative(),
    sustain: z.number().min(0).max(1),
    release: z.number().nonnegative(),
  })
  .strict();

export const synthPresetV1Schema = z
  .object({
    presetId: z.string().regex(/^[a-z0-9-]+$/),
    version: z.literal(1),
    name: z.string().min(1).max(40),
    description: z.string().min(1).max(160),
    family: z.enum(["melodic", "drums"]),
    oscillator: z.enum(["sine", "triangle", "square", "sawtooth"]),
    envelope: envelopeSchema,
    filterHz: z.number().int().min(80).max(20_000),
    filterQ: z.number().min(0).max(20),
    chorusWet: z.number().min(0).max(1),
    delayWet: z.number().min(0).max(1),
    reverbWet: z.number().min(0).max(1),
    gainDb: z.number().min(-24).max(0),
    maxPolyphony: z.number().int().min(1).max(MAX_PROJECT_SYNTH_VOICES),
    minNote: z.number().int().min(0).max(127),
    maxNote: z.number().int().min(0).max(127),
    drumMap: z
      .record(z.string().regex(/^\d+$/), z.string().trim().min(1).max(40))
      .nullable(),
  })
  .strict()
  .superRefine(({ family, minNote, maxNote, drumMap }, context) => {
    if (minNote > maxNote) {
      context.addIssue({ code: "custom", message: "Invalid note range" });
    }
    if ((family === "drums") !== Boolean(drumMap)) {
      context.addIssue({ code: "custom", message: "Invalid drum mapping" });
    }
    for (const pitch of Object.keys(drumMap ?? {}).map(Number)) {
      if (pitch < minNote || pitch > maxNote) {
        context.addIssue({ code: "custom", message: "Invalid drum pitch" });
      }
    }
  });

export type SynthPresetV1 = z.infer<typeof synthPresetV1Schema>;

export const MIDI_ENGINE_ID = "jam-session-midi";
export const MIDI_ENGINE_VERSION = "jam-session-midi-3_tone-15.1.22_presets-1";
export const LEGACY_MIDI_ENGINE_VERSION =
  "jam-session-composite-2_tone-15.1.22";
export const INSTRUMENT_CATALOG_VERSION = 1;

export const INSTRUMENT_FAMILIES = [
  "drums-percussion",
  "basses",
  "keys",
  "leads",
  "pads-strings",
  "plucks-bells-textures",
] as const;

export type InstrumentFamily = (typeof INSTRUMENT_FAMILIES)[number];

const synthesisParametersV1Schema = z
  .object({
    voice: z.enum(["synth", "fm", "am", "membrane"]),
    oscillator: z.enum(["sine", "triangle", "square", "sawtooth"]),
    envelope: envelopeSchema,
    harmonicity: z.number().min(0.25).max(8),
    modulationIndex: z.number().min(0).max(20),
    filterHz: z.number().int().min(80).max(20_000),
    filterQ: z.number().min(0).max(20),
    chorusWet: z.number().min(0).max(1),
    delayWet: z.number().min(0).max(1),
    reverbWet: z.number().min(0).max(1),
    gainDb: z.number().min(-24).max(0),
  })
  .strict();

export type SynthesisParametersV1 = z.infer<typeof synthesisParametersV1Schema>;

const parameterFieldSchema = z
  .object({
    id: z.enum(["brightness", "attack", "release", "space"]),
    label: z.string().min(1),
    min: z.number(),
    max: z.number(),
    step: z.number().positive(),
    defaultValue: z.number(),
    unit: z.enum(["normalized", "seconds"]),
  })
  .strict();

const presetParameterSchemaV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    fields: z.array(parameterFieldSchema).length(4),
  })
  .strict();

export const PRESET_PARAMETER_SCHEMA_V1 = deepFreeze(
  presetParameterSchemaV1Schema.parse({
    schemaVersion: 1,
    fields: [
      {
        id: "brightness",
        label: "Brightness",
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.5,
        unit: "normalized",
      },
      {
        id: "attack",
        label: "Attack",
        min: 0.001,
        max: 2,
        step: 0.001,
        defaultValue: 0.02,
        unit: "seconds",
      },
      {
        id: "release",
        label: "Release",
        min: 0.01,
        max: 4,
        step: 0.01,
        defaultValue: 0.5,
        unit: "seconds",
      },
      {
        id: "space",
        label: "Space",
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.1,
        unit: "normalized",
      },
    ],
  }),
);

export const instrumentPresetV1Schema = z
  .object({
    catalogVersion: z.literal(INSTRUMENT_CATALOG_VERSION),
    presetId: z.string().regex(/^[a-z0-9-]+$/),
    version: z.literal(1),
    family: z.enum(INSTRUMENT_FAMILIES),
    name: z.string().min(1).max(40),
    description: z.string().min(1).max(160),
    minNote: z.number().int().min(0).max(127),
    maxNote: z.number().int().min(0).max(127),
    maxPolyphony: z.number().int().min(1).max(MAX_PROJECT_SYNTH_VOICES),
    engineVersion: z.literal(MIDI_ENGINE_VERSION),
    parameterSchema: presetParameterSchemaV1Schema,
    parameters: synthesisParametersV1Schema,
    status: z.enum(["active", "deprecated"]),
    drumMap: z
      .record(z.string().regex(/^\d+$/), z.string().trim().min(1).max(40))
      .nullable(),
  })
  .strict()
  .superRefine(({ family, minNote, maxNote, drumMap }, context) => {
    if (minNote > maxNote) {
      context.addIssue({ code: "custom", message: "Invalid note range" });
    }
    if ((family === "drums-percussion") !== Boolean(drumMap)) {
      context.addIssue({ code: "custom", message: "Invalid drum mapping" });
    }
    for (const pitch of Object.keys(drumMap ?? {}).map(Number)) {
      if (pitch < minNote || pitch > maxNote) {
        context.addIssue({ code: "custom", message: "Invalid drum pitch" });
      }
    }
  });

export type InstrumentPresetV1 = z.infer<typeof instrumentPresetV1Schema>;
export type ResolvedSynthPreset = SynthPresetV1 | InstrumentPresetV1;

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function preset(input: SynthPresetV1) {
  return Object.freeze(synthPresetV1Schema.parse(input));
}

export const SYNTH_PRESETS_V1 = Object.freeze([
  preset({
    presetId: "warm-poly",
    version: 1,
    name: "Warm Poly",
    description: "A rounded poly synth for chords and steady harmonic parts.",
    family: "melodic",
    oscillator: "triangle",
    envelope: { attack: 0.03, decay: 0.3, sustain: 0.72, release: 0.8 },
    filterHz: 4_800,
    filterQ: 1.2,
    chorusWet: 0.16,
    delayWet: 0,
    reverbWet: 0.1,
    gainDb: -10,
    maxPolyphony: 8,
    minNote: 36,
    maxNote: 96,
    drumMap: null,
  }),
  preset({
    presetId: "glass-keys",
    version: 1,
    name: "Glass Keys",
    description:
      "A clear, quick-decay synth voice for bright keyboard patterns.",
    family: "melodic",
    oscillator: "sine",
    envelope: { attack: 0.005, decay: 0.65, sustain: 0.22, release: 0.9 },
    filterHz: 9_000,
    filterQ: 0.7,
    chorusWet: 0.08,
    delayWet: 0.12,
    reverbWet: 0.14,
    gainDb: -9,
    maxPolyphony: 8,
    minNote: 36,
    maxNote: 108,
    drumMap: null,
  }),
  preset({
    presetId: "round-bass",
    version: 1,
    name: "Round Bass",
    description: "A compact low synth with a soft edge and short release.",
    family: "melodic",
    oscillator: "square",
    envelope: { attack: 0.01, decay: 0.24, sustain: 0.64, release: 0.18 },
    filterHz: 1_200,
    filterQ: 1.8,
    chorusWet: 0,
    delayWet: 0,
    reverbWet: 0.02,
    gainDb: -12,
    maxPolyphony: 4,
    minNote: 24,
    maxNote: 60,
    drumMap: null,
  }),
  preset({
    presetId: "soft-pad",
    version: 1,
    name: "Soft Pad",
    description: "A slow-opening synth bed for sustained harmony.",
    family: "melodic",
    oscillator: "sawtooth",
    envelope: { attack: 0.7, decay: 0.8, sustain: 0.78, release: 1.8 },
    filterHz: 2_600,
    filterQ: 0.8,
    chorusWet: 0.24,
    delayWet: 0,
    reverbWet: 0.18,
    gainDb: -15,
    maxPolyphony: 8,
    minNote: 36,
    maxNote: 96,
    drumMap: null,
  }),
  preset({
    presetId: "bright-lead",
    version: 1,
    name: "Bright Lead",
    description: "A focused saw synth for single-note melodies and hooks.",
    family: "melodic",
    oscillator: "sawtooth",
    envelope: { attack: 0.01, decay: 0.14, sustain: 0.7, release: 0.24 },
    filterHz: 7_200,
    filterQ: 2.4,
    chorusWet: 0.06,
    delayWet: 0.1,
    reverbWet: 0.05,
    gainDb: -13,
    maxPolyphony: 4,
    minNote: 48,
    maxNote: 108,
    drumMap: null,
  }),
  preset({
    presetId: "air-pluck",
    version: 1,
    name: "Air Pluck",
    description: "A light plucked synth for rhythmic figures and arpeggios.",
    family: "melodic",
    oscillator: "triangle",
    envelope: { attack: 0.002, decay: 0.18, sustain: 0.08, release: 0.3 },
    filterHz: 6_400,
    filterQ: 1.1,
    chorusWet: 0.08,
    delayWet: 0.14,
    reverbWet: 0.08,
    gainDb: -9,
    maxPolyphony: 8,
    minNote: 36,
    maxNote: 108,
    drumMap: null,
  }),
  preset({
    presetId: "studio-drums",
    version: 1,
    name: "Studio Drums",
    description:
      "A small synthesized kick, snare, hat, and tom kit with no samples.",
    family: "drums",
    oscillator: "sine",
    envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.12 },
    filterHz: 8_000,
    filterQ: 0.8,
    chorusWet: 0,
    delayWet: 0,
    reverbWet: 0.04,
    gainDb: -12,
    maxPolyphony: 8,
    minNote: 36,
    maxNote: 48,
    drumMap: {
      "36": "Kick",
      "38": "Snare",
      "42": "Closed hat",
      "45": "Low tom",
      "47": "Mid tom",
      "48": "High tom",
    },
  }),
] satisfies readonly SynthPresetV1[]);

const GM_DRUM_MAP = deepFreeze({
  "35": "Acoustic bass drum",
  "36": "Bass drum",
  "37": "Side stick",
  "38": "Acoustic snare",
  "39": "Hand clap",
  "40": "Electric snare",
  "41": "Low floor tom",
  "42": "Closed hi-hat",
  "43": "High floor tom",
  "44": "Pedal hi-hat",
  "45": "Low tom",
  "46": "Open hi-hat",
  "47": "Low-mid tom",
  "48": "High-mid tom",
  "49": "Crash cymbal",
  "50": "High tom",
  "51": "Ride cymbal",
  "54": "Tambourine",
  "56": "Cowbell",
  "60": "High bongo",
  "61": "Low bongo",
  "62": "Mute high conga",
  "63": "Open high conga",
  "64": "Low conga",
  "70": "Maracas",
  "75": "Claves",
  "76": "High wood block",
  "77": "Low wood block",
  "81": "Open triangle",
});

function synthesis(
  input: Partial<SynthesisParametersV1> &
    Pick<SynthesisParametersV1, "voice" | "oscillator" | "envelope">,
): SynthesisParametersV1 {
  return synthesisParametersV1Schema.parse({
    harmonicity: 1,
    modulationIndex: 2,
    filterHz: 5_000,
    filterQ: 1,
    chorusWet: 0,
    delayWet: 0,
    reverbWet: 0.08,
    gainDb: -12,
    ...input,
  });
}

type CatalogPresetInput = Omit<
  InstrumentPresetV1,
  "catalogVersion" | "version" | "engineVersion" | "parameterSchema" | "status"
>;

function catalogPreset(input: CatalogPresetInput): InstrumentPresetV1 {
  return deepFreeze(
    instrumentPresetV1Schema.parse({
      catalogVersion: INSTRUMENT_CATALOG_VERSION,
      version: 1,
      engineVersion: MIDI_ENGINE_VERSION,
      parameterSchema: PRESET_PARAMETER_SCHEMA_V1,
      status: "active",
      ...input,
    }),
  ) as InstrumentPresetV1;
}

const drumEnvelope = {
  attack: 0.001,
  decay: 0.2,
  sustain: 0,
  release: 0.1,
};

export const INSTRUMENT_PRESETS_CATALOG_1 = deepFreeze([
  catalogPreset({
    presetId: "drum-machine",
    family: "drums-percussion",
    name: "Drum Machine",
    description: "A balanced synthesized kit for punchy, dependable grooves.",
    minNote: 35,
    maxNote: 81,
    maxPolyphony: 12,
    drumMap: GM_DRUM_MAP,
    parameters: synthesis({
      voice: "membrane",
      oscillator: "sine",
      envelope: drumEnvelope,
      filterHz: 9_000,
      gainDb: -11,
    }),
  }),
  catalogPreset({
    presetId: "electro-kit",
    family: "drums-percussion",
    name: "Electro Kit",
    description: "A bright synthesized kit with a tight electronic snap.",
    minNote: 35,
    maxNote: 81,
    maxPolyphony: 12,
    drumMap: GM_DRUM_MAP,
    parameters: synthesis({
      voice: "membrane",
      oscillator: "square",
      envelope: { ...drumEnvelope, decay: 0.13 },
      filterHz: 12_000,
      filterQ: 1.8,
      gainDb: -13,
    }),
  }),
  catalogPreset({
    presetId: "lofi-kit",
    family: "drums-percussion",
    name: "Lo-fi Kit",
    description: "A softened synthesized kit for dusty, relaxed rhythms.",
    minNote: 35,
    maxNote: 81,
    maxPolyphony: 10,
    drumMap: GM_DRUM_MAP,
    parameters: synthesis({
      voice: "membrane",
      oscillator: "triangle",
      envelope: { ...drumEnvelope, decay: 0.26 },
      filterHz: 4_600,
      reverbWet: 0.03,
      gainDb: -10,
    }),
  }),
  catalogPreset({
    presetId: "percussion-rack",
    family: "drums-percussion",
    name: "Percussion Rack",
    description: "A resonant synthesized rack for toms, blocks, and accents.",
    minNote: 35,
    maxNote: 81,
    maxPolyphony: 12,
    drumMap: GM_DRUM_MAP,
    parameters: synthesis({
      voice: "membrane",
      oscillator: "sine",
      envelope: { ...drumEnvelope, decay: 0.32, release: 0.18 },
      filterHz: 7_200,
      reverbWet: 0.12,
      gainDb: -13,
    }),
  }),
  catalogPreset({
    presetId: "sub-bass",
    family: "basses",
    name: "Sub Bass",
    description: "A clean sine foundation for deep, controlled low end.",
    minNote: 24,
    maxNote: 60,
    maxPolyphony: 2,
    drumMap: null,
    parameters: synthesis({
      voice: "synth",
      oscillator: "sine",
      envelope: { attack: 0.01, decay: 0.18, sustain: 0.82, release: 0.2 },
      filterHz: 900,
      gainDb: -9,
      reverbWet: 0,
    }),
  }),
  catalogPreset({
    presetId: "analog-bass",
    family: "basses",
    name: "Analog Bass",
    description: "A rounded saw bass for steady riffs and warm movement.",
    minNote: 24,
    maxNote: 67,
    maxPolyphony: 4,
    drumMap: null,
    parameters: synthesis({
      voice: "synth",
      oscillator: "sawtooth",
      envelope: { attack: 0.008, decay: 0.24, sustain: 0.58, release: 0.22 },
      filterHz: 1_450,
      filterQ: 2.2,
      gainDb: -13,
    }),
  }),
  catalogPreset({
    presetId: "fm-bass",
    family: "basses",
    name: "FM Bass",
    description: "A compact frequency-modulated bass with a firm attack.",
    minNote: 24,
    maxNote: 72,
    maxPolyphony: 4,
    drumMap: null,
    parameters: synthesis({
      voice: "fm",
      oscillator: "sine",
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.5, release: 0.18 },
      harmonicity: 1.5,
      modulationIndex: 7,
      filterHz: 2_400,
      gainDb: -14,
    }),
  }),
  catalogPreset({
    presetId: "pluck-bass",
    family: "basses",
    name: "Pluck Bass",
    description: "A short, woody bass for syncopated and percussive lines.",
    minNote: 28,
    maxNote: 72,
    maxPolyphony: 4,
    drumMap: null,
    parameters: synthesis({
      voice: "am",
      oscillator: "triangle",
      envelope: { attack: 0.002, decay: 0.16, sustain: 0.12, release: 0.14 },
      harmonicity: 1.8,
      filterHz: 2_100,
      gainDb: -11,
    }),
  }),
  catalogPreset({
    presetId: "warm-keys",
    family: "keys",
    name: "Warm Keys",
    description:
      "Rounded polyphonic keys for chords, sketches, and accompaniment.",
    minNote: 24,
    maxNote: 108,
    maxPolyphony: 10,
    drumMap: null,
    parameters: synthesis({
      voice: "synth",
      oscillator: "triangle",
      envelope: { attack: 0.025, decay: 0.32, sustain: 0.68, release: 0.7 },
      filterHz: 4_800,
      chorusWet: 0.14,
      gainDb: -11,
    }),
  }),
  catalogPreset({
    presetId: "electric-keys",
    family: "keys",
    name: "Electric Keys",
    description: "Soft electric-style keys with a clear bell-like attack.",
    minNote: 24,
    maxNote: 108,
    maxPolyphony: 10,
    drumMap: null,
    parameters: synthesis({
      voice: "fm",
      oscillator: "sine",
      envelope: { attack: 0.006, decay: 0.7, sustain: 0.32, release: 0.8 },
      harmonicity: 3,
      modulationIndex: 3.2,
      filterHz: 7_500,
      chorusWet: 0.12,
      gainDb: -13,
    }),
  }),
  catalogPreset({
    presetId: "organ",
    family: "keys",
    name: "Organ",
    description: "A steady additive-style organ voice for sustained harmony.",
    minNote: 24,
    maxNote: 108,
    maxPolyphony: 10,
    drumMap: null,
    parameters: synthesis({
      voice: "am",
      oscillator: "sine",
      envelope: { attack: 0.015, decay: 0.05, sustain: 0.94, release: 0.22 },
      harmonicity: 2,
      filterHz: 6_200,
      chorusWet: 0.18,
      gainDb: -15,
    }),
  }),
  catalogPreset({
    presetId: "glass-keys",
    family: "keys",
    name: "Glass Keys",
    description: "Clear, quick-decay keys for bright patterns and accents.",
    minNote: 36,
    maxNote: 108,
    maxPolyphony: 10,
    drumMap: null,
    parameters: synthesis({
      voice: "fm",
      oscillator: "sine",
      envelope: { attack: 0.003, decay: 0.75, sustain: 0.18, release: 1 },
      harmonicity: 4,
      modulationIndex: 5,
      filterHz: 10_500,
      delayWet: 0.1,
      reverbWet: 0.16,
      gainDb: -15,
    }),
  }),
  catalogPreset({
    presetId: "saw-lead",
    family: "leads",
    name: "Saw Lead",
    description: "A direct saw lead for hooks that need a bright edge.",
    minNote: 36,
    maxNote: 108,
    maxPolyphony: 4,
    drumMap: null,
    parameters: synthesis({
      voice: "synth",
      oscillator: "sawtooth",
      envelope: { attack: 0.008, decay: 0.14, sustain: 0.72, release: 0.24 },
      filterHz: 7_800,
      filterQ: 2.6,
      delayWet: 0.08,
      gainDb: -15,
    }),
  }),
  catalogPreset({
    presetId: "square-lead",
    family: "leads",
    name: "Square Lead",
    description: "A focused square lead for retro melodies and counterlines.",
    minNote: 36,
    maxNote: 108,
    maxPolyphony: 4,
    drumMap: null,
    parameters: synthesis({
      voice: "synth",
      oscillator: "square",
      envelope: { attack: 0.006, decay: 0.12, sustain: 0.66, release: 0.2 },
      filterHz: 6_600,
      delayWet: 0.06,
      gainDb: -16,
    }),
  }),
  catalogPreset({
    presetId: "fm-lead",
    family: "leads",
    name: "FM Lead",
    description: "A vivid frequency-modulated lead for expressive motifs.",
    minNote: 36,
    maxNote: 108,
    maxPolyphony: 4,
    drumMap: null,
    parameters: synthesis({
      voice: "fm",
      oscillator: "sine",
      envelope: { attack: 0.008, decay: 0.18, sustain: 0.62, release: 0.3 },
      harmonicity: 2,
      modulationIndex: 6,
      filterHz: 8_200,
      delayWet: 0.11,
      gainDb: -16,
    }),
  }),
  catalogPreset({
    presetId: "soft-lead",
    family: "leads",
    name: "Soft Lead",
    description: "A rounded triangle lead for gentle melodies and layers.",
    minNote: 36,
    maxNote: 108,
    maxPolyphony: 4,
    drumMap: null,
    parameters: synthesis({
      voice: "synth",
      oscillator: "triangle",
      envelope: { attack: 0.035, decay: 0.22, sustain: 0.7, release: 0.5 },
      filterHz: 4_500,
      chorusWet: 0.08,
      reverbWet: 0.12,
      gainDb: -13,
    }),
  }),
  catalogPreset({
    presetId: "warm-pad",
    family: "pads-strings",
    name: "Warm Pad",
    description: "A slow-opening warm pad for broad harmonic beds.",
    minNote: 24,
    maxNote: 108,
    maxPolyphony: 12,
    drumMap: null,
    parameters: synthesis({
      voice: "synth",
      oscillator: "sawtooth",
      envelope: { attack: 0.65, decay: 0.8, sustain: 0.78, release: 1.8 },
      filterHz: 2_700,
      chorusWet: 0.24,
      reverbWet: 0.2,
      gainDb: -17,
    }),
  }),
  catalogPreset({
    presetId: "air-pad",
    family: "pads-strings",
    name: "Air Pad",
    description: "A light, spacious pad for open chords and atmosphere.",
    minNote: 36,
    maxNote: 108,
    maxPolyphony: 12,
    drumMap: null,
    parameters: synthesis({
      voice: "am",
      oscillator: "sine",
      envelope: { attack: 0.9, decay: 1, sustain: 0.72, release: 2.4 },
      harmonicity: 1.5,
      filterHz: 7_200,
      chorusWet: 0.2,
      reverbWet: 0.28,
      gainDb: -18,
    }),
  }),
  catalogPreset({
    presetId: "string-pad",
    family: "pads-strings",
    name: "String Pad",
    description: "A smooth synthesized string layer for sustained movement.",
    minNote: 24,
    maxNote: 108,
    maxPolyphony: 12,
    drumMap: null,
    parameters: synthesis({
      voice: "synth",
      oscillator: "sawtooth",
      envelope: { attack: 0.38, decay: 0.5, sustain: 0.82, release: 1.5 },
      filterHz: 3_900,
      chorusWet: 0.3,
      reverbWet: 0.18,
      gainDb: -18,
    }),
  }),
  catalogPreset({
    presetId: "choir-pad",
    family: "pads-strings",
    name: "Choir Pad",
    description: "A soft formant-like pad for cinematic harmonic support.",
    minNote: 36,
    maxNote: 96,
    maxPolyphony: 10,
    drumMap: null,
    parameters: synthesis({
      voice: "fm",
      oscillator: "sine",
      envelope: { attack: 0.55, decay: 0.7, sustain: 0.75, release: 1.9 },
      harmonicity: 0.5,
      modulationIndex: 1.8,
      filterHz: 3_200,
      chorusWet: 0.22,
      reverbWet: 0.24,
      gainDb: -16,
    }),
  }),
  catalogPreset({
    presetId: "muted-pluck",
    family: "plucks-bells-textures",
    name: "Muted Pluck",
    description: "A compact muted pluck for dry rhythmic patterns.",
    minNote: 36,
    maxNote: 108,
    maxPolyphony: 8,
    drumMap: null,
    parameters: synthesis({
      voice: "am",
      oscillator: "triangle",
      envelope: { attack: 0.002, decay: 0.14, sustain: 0.05, release: 0.16 },
      harmonicity: 1.3,
      filterHz: 3_800,
      reverbWet: 0.03,
      gainDb: -10,
    }),
  }),
  catalogPreset({
    presetId: "bright-pluck",
    family: "plucks-bells-textures",
    name: "Bright Pluck",
    description: "A crisp pluck for arpeggios and quick melodic figures.",
    minNote: 36,
    maxNote: 108,
    maxPolyphony: 10,
    drumMap: null,
    parameters: synthesis({
      voice: "synth",
      oscillator: "triangle",
      envelope: { attack: 0.001, decay: 0.2, sustain: 0.06, release: 0.32 },
      filterHz: 9_200,
      delayWet: 0.12,
      reverbWet: 0.1,
      gainDb: -11,
    }),
  }),
  catalogPreset({
    presetId: "bell",
    family: "plucks-bells-textures",
    name: "Bell",
    description: "A clear synthesized bell for sparse melodic accents.",
    minNote: 48,
    maxNote: 108,
    maxPolyphony: 10,
    drumMap: null,
    parameters: synthesis({
      voice: "fm",
      oscillator: "sine",
      envelope: { attack: 0.001, decay: 1.2, sustain: 0.05, release: 1.8 },
      harmonicity: 5,
      modulationIndex: 9,
      filterHz: 12_000,
      delayWet: 0.08,
      reverbWet: 0.2,
      gainDb: -18,
    }),
  }),
  catalogPreset({
    presetId: "mallet",
    family: "plucks-bells-textures",
    name: "Mallet",
    description:
      "A rounded synthetic mallet for repeating motifs and ostinatos.",
    minNote: 36,
    maxNote: 108,
    maxPolyphony: 10,
    drumMap: null,
    parameters: synthesis({
      voice: "fm",
      oscillator: "sine",
      envelope: { attack: 0.002, decay: 0.65, sustain: 0.1, release: 0.7 },
      harmonicity: 3.5,
      modulationIndex: 4,
      filterHz: 8_400,
      reverbWet: 0.12,
      gainDb: -14,
    }),
  }),
] satisfies readonly InstrumentPresetV1[]);

export function resolveSynthPreset(
  presetId: string,
  version: number,
  engineVersion?: string,
) {
  const catalogPreset = INSTRUMENT_PRESETS_CATALOG_1.find(
    (candidate) =>
      candidate.presetId === presetId && candidate.version === version,
  );
  const legacyPreset = SYNTH_PRESETS_V1.find(
    (candidate) =>
      candidate.presetId === presetId && candidate.version === version,
  );
  const preset =
    engineVersion === MIDI_ENGINE_VERSION
      ? catalogPreset
      : engineVersion === LEGACY_MIDI_ENGINE_VERSION
        ? legacyPreset
        : engineVersion === undefined
          ? (legacyPreset ?? catalogPreset)
          : undefined;
  if (!preset)
    throw new Error(`Unsupported synth preset ${presetId}@${version}`);
  return preset;
}

export function resolveCatalogPreset(presetId: string, version: number) {
  const preset = INSTRUMENT_PRESETS_CATALOG_1.find(
    (candidate) =>
      candidate.presetId === presetId && candidate.version === version,
  );
  if (!preset)
    throw new Error(`Unsupported catalog preset ${presetId}@${version}`);
  return preset;
}
