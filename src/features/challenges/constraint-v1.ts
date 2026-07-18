import { z } from "zod";
import {
  INSTRUMENT_FAMILIES,
  INSTRUMENT_PRESETS_CATALOG_1,
  type InstrumentFamily,
} from "@/features/midi/presets";
import { MIDI_V3_MAX_TEMPO_BPM } from "@/features/midi/domain-v3";
import { formatMusicalKey } from "@/features/projects/musical-key";
import { musicalKeys } from "@/features/projects/schema";

const presetIds = new Set(
  INSTRUMENT_PRESETS_CATALOG_1.map(
    (preset) => `${preset.presetId}@${preset.version}`,
  ),
);

const integerRangeSchema = z
  .object({
    minimum: z.number().int().min(0).max(32).nullable().default(null),
    maximum: z.number().int().min(0).max(32).nullable().default(null),
    exact: z.number().int().min(0).max(32).nullable().default(null),
  })
  .strict()
  .superRefine(validateRange);

const tempoRangeSchema = z
  .object({
    minimum: z
      .number()
      .min(20)
      .max(MIDI_V3_MAX_TEMPO_BPM)
      .nullable()
      .default(null),
    maximum: z
      .number()
      .min(20)
      .max(MIDI_V3_MAX_TEMPO_BPM)
      .nullable()
      .default(null),
    exact: z
      .number()
      .min(20)
      .max(MIDI_V3_MAX_TEMPO_BPM)
      .nullable()
      .default(null),
  })
  .strict()
  .superRefine((range, context) => {
    validateRange(range, context);
    for (const value of [range.minimum, range.maximum, range.exact]) {
      if (value !== null && Math.round(value * 1000) !== value * 1000) {
        context.addIssue({
          code: "custom",
          message: "Tempo may use at most three decimal places.",
        });
      }
    }
  });

const presetVersionSchema = z
  .object({ presetId: z.string(), version: z.number().int().positive() })
  .strict()
  .superRefine((preset, context) => {
    if (!presetIds.has(`${preset.presetId}@${preset.version}`)) {
      context.addIssue({ code: "custom", message: "Unknown preset version." });
    }
  });

const instrumentsSchema = z
  .object({
    allowedPresetVersions: z.array(presetVersionSchema).default([]),
    requiredPresetVersions: z.array(presetVersionSchema).default([]),
    allowedFamilies: z.array(z.enum(INSTRUMENT_FAMILIES)).default([]),
    requiredFamilies: z.array(z.enum(INSTRUMENT_FAMILIES)).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    rejectDuplicates(
      value.allowedPresetVersions.map(presetKey),
      "allowed preset",
      context,
    );
    rejectDuplicates(
      value.requiredPresetVersions.map(presetKey),
      "required preset",
      context,
    );
    rejectDuplicates(value.allowedFamilies, "allowed family", context);
    rejectDuplicates(value.requiredFamilies, "required family", context);
  });

const timeSignatureSchema = z
  .object({
    numerator: z.number().int().min(1).max(32),
    denominator: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(4),
      z.literal(8),
      z.literal(16),
      z.literal(32),
    ]),
  })
  .strict();

export const challengeConstraintsV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    trackCount: integerRangeSchema.nullable().optional(),
    distinctInstrumentCount: integerRangeSchema.nullable().optional(),
    instruments: instrumentsSchema.nullable().optional(),
    tempoBpm: tempoRangeSchema.nullable().optional(),
    timeSignature: timeSignatureSchema.nullable().optional(),
    musicalKey: z.enum(musicalKeys).nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const hasInstrumentRule = value.instruments
      ? Object.values(value.instruments).some((items) => items.length > 0)
      : false;
    if (
      !value.trackCount &&
      !value.distinctInstrumentCount &&
      !hasInstrumentRule &&
      !value.tempoBpm &&
      !value.timeSignature &&
      !value.musicalKey
    ) {
      context.addIssue({
        code: "custom",
        message: "Add at least one machine-checkable rule.",
      });
    }
  });

export type ChallengeConstraintsV1 = z.infer<
  typeof challengeConstraintsV1Schema
>;

export type CanonicalChallengeConstraintsV1 = {
  schemaVersion: 1;
  trackCount: RangeRule | null;
  distinctInstrumentCount: RangeRule | null;
  instruments: {
    allowedPresetVersions: PresetVersion[];
    requiredPresetVersions: PresetVersion[];
    allowedFamilies: InstrumentFamily[];
    requiredFamilies: InstrumentFamily[];
  } | null;
  tempoBpm: RangeRule | null;
  timeSignature: { numerator: number; denominator: number } | null;
  musicalKey: (typeof musicalKeys)[number] | null;
};

type RangeRule = {
  minimum: number | null;
  maximum: number | null;
  exact: number | null;
};
type PresetVersion = { presetId: string; version: number };

export function canonicalizeChallengeConstraintsV1(
  input: unknown,
): CanonicalChallengeConstraintsV1 {
  const value = challengeConstraintsV1Schema.parse(input);
  const instruments = value.instruments;
  return {
    schemaVersion: 1,
    trackCount: canonicalRange(value.trackCount),
    distinctInstrumentCount: canonicalRange(value.distinctInstrumentCount),
    instruments: instruments
      ? {
          allowedPresetVersions: [...instruments.allowedPresetVersions].sort(
            comparePresets,
          ),
          requiredPresetVersions: [...instruments.requiredPresetVersions].sort(
            comparePresets,
          ),
          allowedFamilies: [...instruments.allowedFamilies].sort(),
          requiredFamilies: [...instruments.requiredFamilies].sort(),
        }
      : null,
    tempoBpm: canonicalRange(value.tempoBpm),
    timeSignature: value.timeSignature ?? null,
    musicalKey: value.musicalKey ?? null,
  };
}

export function challengeConstraintHashInput(input: unknown) {
  return JSON.stringify(canonicalizeChallengeConstraintsV1(input));
}

export function describeChallengeConstraintsV1(input: unknown): string[] {
  const value = canonicalizeChallengeConstraintsV1(input);
  const rules: string[] = [];
  if (value.trackCount)
    rules.push(`Use ${describeRange(value.trackCount, "track")}.`);
  if (value.distinctInstrumentCount)
    rules.push(
      `Use ${describeRange(value.distinctInstrumentCount, "distinct instrument")}.`,
    );
  if (value.instruments) {
    const allowed = [
      ...value.instruments.allowedPresetVersions.map(presetName),
      ...value.instruments.allowedFamilies.map(familyName),
    ];
    const required = [
      ...value.instruments.requiredPresetVersions.map(presetName),
      ...value.instruments.requiredFamilies.map(familyName),
    ];
    if (allowed.length)
      rules.push(`Every track must use one of: ${allowed.join(", ")}.`);
    if (required.length) rules.push(`Include each of: ${required.join(", ")}.`);
  }
  if (value.tempoBpm)
    rules.push(
      `Set the tempo to ${describeRange(value.tempoBpm, "BPM", false)}.`,
    );
  if (value.timeSignature)
    rules.push(
      `Use a ${value.timeSignature.numerator}/${value.timeSignature.denominator} time signature.`,
    );
  if (value.musicalKey)
    rules.push(
      `Declare the project key as ${formatMusicalKey(value.musicalKey)}.`,
    );
  return rules;
}

function validateRange(range: RangeRule, context: z.RefinementCtx) {
  if (range.minimum === null && range.maximum === null && range.exact === null)
    context.addIssue({
      code: "custom",
      message: "Set at least one range value.",
    });
  if (
    range.exact !== null &&
    (range.minimum !== null || range.maximum !== null)
  )
    context.addIssue({
      code: "custom",
      message: "Exact cannot be combined with minimum or maximum.",
    });
  if (
    range.minimum !== null &&
    range.maximum !== null &&
    range.minimum > range.maximum
  )
    context.addIssue({
      code: "custom",
      message: "Minimum cannot exceed maximum.",
    });
}

function rejectDuplicates(
  values: string[],
  label: string,
  context: z.RefinementCtx,
) {
  if (new Set(values).size !== values.length)
    context.addIssue({ code: "custom", message: `Duplicate ${label}.` });
}

function canonicalRange(range: RangeRule | null | undefined): RangeRule | null {
  return range
    ? {
        minimum: range.minimum ?? null,
        maximum: range.maximum ?? null,
        exact: range.exact ?? null,
      }
    : null;
}

function presetKey(preset: PresetVersion) {
  return `${preset.presetId}@${preset.version}`;
}

function comparePresets(left: PresetVersion, right: PresetVersion) {
  return presetKey(left).localeCompare(presetKey(right));
}

function presetName(preset: PresetVersion) {
  const match = INSTRUMENT_PRESETS_CATALOG_1.find(
    (candidate) =>
      candidate.presetId === preset.presetId &&
      candidate.version === preset.version,
  );
  return `${match?.name ?? preset.presetId} v${preset.version}`;
}

function familyName(family: InstrumentFamily) {
  return family.replaceAll("-", " ");
}

function describeRange(range: RangeRule, noun: string, pluralize = true) {
  if (range.exact !== null)
    return `${range.exact} ${noun}${pluralize && range.exact === 1 ? "" : pluralize ? "s" : ""}`;
  if (range.minimum !== null && range.maximum !== null)
    return `${range.minimum}–${range.maximum} ${noun}${pluralize ? "s" : ""}`;
  if (range.minimum !== null)
    return `at least ${range.minimum} ${noun}${pluralize && range.minimum === 1 ? "" : pluralize ? "s" : ""}`;
  return `at most ${range.maximum} ${noun}${pluralize && range.maximum === 1 ? "" : pluralize ? "s" : ""}`;
}
