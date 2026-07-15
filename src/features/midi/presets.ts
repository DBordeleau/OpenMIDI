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

export function resolveSynthPreset(presetId: string, version: number) {
  const preset = SYNTH_PRESETS_V1.find(
    (candidate) =>
      candidate.presetId === presetId && candidate.version === version,
  );
  if (!preset)
    throw new Error(`Unsupported synth preset ${presetId}@${version}`);
  return preset;
}
