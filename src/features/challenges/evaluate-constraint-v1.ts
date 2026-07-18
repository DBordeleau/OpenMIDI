import { z } from "zod";
import {
  INSTRUMENT_FAMILIES,
  INSTRUMENT_PRESETS_CATALOG_1,
} from "@/features/midi/presets";
import { formatMusicalKey } from "@/features/projects/musical-key";
import { musicalKeys } from "@/features/projects/schema";
import {
  canonicalizeChallengeConstraintsV1,
  type CanonicalChallengeConstraintsV1,
} from "./constraint-v1";

const presetVersionSchema = z
  .object({ presetId: z.string().min(1), version: z.number().int().positive() })
  .strict()
  .superRefine((value, context) => {
    if (
      !INSTRUMENT_PRESETS_CATALOG_1.some(
        (preset) => presetKey(preset) === presetKey(value),
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Unknown observed preset version.",
      });
    }
  });

export const challengeFactsV1Schema = z
  .object({
    trackCount: z.number().int().min(0).max(32),
    distinctInstrumentCount: z.number().int().min(0).max(32),
    presetVersions: z.array(presetVersionSchema).max(32),
    families: z.array(z.enum(INSTRUMENT_FAMILIES)).max(32),
    tempoBpm: z.number().min(20).max(300),
    timeSignature: z
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
      .strict(),
    musicalKey: z.enum(musicalKeys).nullable(),
  })
  .strict();

const ruleNameSchema = z.enum([
  "track_count",
  "distinct_instrument_count",
  "allowed_instruments",
  "required_instruments",
  "tempo_bpm",
  "time_signature",
  "musical_key",
]);

export const challengeEvaluationV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    eligible: z.boolean(),
    facts: challengeFactsV1Schema,
    rules: z
      .array(
        z
          .object({
            rule: ruleNameSchema,
            passed: z.boolean(),
            observed: z.unknown(),
            required: z.unknown(),
            message: z.string().min(1).max(500),
          })
          .strict(),
      )
      .min(1)
      .max(7),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.eligible !== value.rules.every((rule) => rule.passed)) {
      context.addIssue({
        code: "custom",
        message: "Eligibility is inconsistent.",
      });
    }
    if (
      new Set(value.rules.map((rule) => rule.rule)).size !== value.rules.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Evaluation rules are duplicated.",
      });
    }
  });

export type ChallengeFactsV1 = z.infer<typeof challengeFactsV1Schema>;
export type ChallengeEvaluationV1 = z.infer<typeof challengeEvaluationV1Schema>;
type EvaluationRule = ChallengeEvaluationV1["rules"][number];

export function evaluateChallengeConstraintsV1(
  constraintsInput: unknown,
  factsInput: unknown,
): ChallengeEvaluationV1 {
  const constraints = canonicalizeChallengeConstraintsV1(constraintsInput);
  const facts = challengeFactsV1Schema.parse(factsInput);
  const rules: EvaluationRule[] = [];

  if (constraints.trackCount) {
    rules.push(
      rangeRule(
        "track_count",
        facts.trackCount,
        constraints.trackCount,
        "track",
      ),
    );
  }
  if (constraints.distinctInstrumentCount) {
    rules.push(
      rangeRule(
        "distinct_instrument_count",
        facts.distinctInstrumentCount,
        constraints.distinctInstrumentCount,
        "distinct instrument",
      ),
    );
  }
  if (constraints.instruments) {
    const allowedPresets = new Set(
      constraints.instruments.allowedPresetVersions.map(presetKey),
    );
    const allowedFamilies = new Set(constraints.instruments.allowedFamilies);
    if (allowedPresets.size || allowedFamilies.size) {
      const disallowed = facts.presetVersions.filter((preset) => {
        const family = INSTRUMENT_PRESETS_CATALOG_1.find(
          (candidate) => presetKey(candidate) === presetKey(preset),
        )?.family;
        return (
          !allowedPresets.has(presetKey(preset)) &&
          (!family || !allowedFamilies.has(family))
        );
      });
      const passed = disallowed.length === 0;
      rules.push({
        rule: "allowed_instruments",
        passed,
        observed: {
          presetVersions: facts.presetVersions,
          families: facts.families,
        },
        required: {
          allowedPresetVersions: constraints.instruments.allowedPresetVersions,
          allowedFamilies: constraints.instruments.allowedFamilies,
        },
        message: passed
          ? "Every track uses an allowed preset version or instrument family."
          : `Change ${formatPresetList(disallowed)} to an allowed preset version or family.`,
      });
    }
    const missingPresets =
      constraints.instruments.requiredPresetVersions.filter(
        (required) =>
          !facts.presetVersions.some(
            (preset) => presetKey(preset) === presetKey(required),
          ),
      );
    const missingFamilies = constraints.instruments.requiredFamilies.filter(
      (required) => !facts.families.includes(required),
    );
    if (
      constraints.instruments.requiredPresetVersions.length ||
      constraints.instruments.requiredFamilies.length
    ) {
      const passed =
        missingPresets.length === 0 && missingFamilies.length === 0;
      const missing = [
        ...missingPresets.map(
          (preset) => `${preset.presetId} v${preset.version}`,
        ),
        ...missingFamilies.map(formatFamily),
      ];
      rules.push({
        rule: "required_instruments",
        passed,
        observed: {
          presetVersions: facts.presetVersions,
          families: facts.families,
        },
        required: {
          requiredPresetVersions:
            constraints.instruments.requiredPresetVersions,
          requiredFamilies: constraints.instruments.requiredFamilies,
        },
        message: passed
          ? "Every required preset version and instrument family is present."
          : `Add a track for each missing requirement: ${missing.join(", ")}.`,
      });
    }
  }
  if (constraints.tempoBpm) {
    rules.push(
      rangeRule("tempo_bpm", facts.tempoBpm, constraints.tempoBpm, "BPM"),
    );
  }
  if (constraints.timeSignature) {
    const passed =
      facts.timeSignature.numerator === constraints.timeSignature.numerator &&
      facts.timeSignature.denominator === constraints.timeSignature.denominator;
    rules.push({
      rule: "time_signature",
      passed,
      observed: facts.timeSignature,
      required: constraints.timeSignature,
      message: passed
        ? `Observed ${meter(facts.timeSignature)}; the required meter is ${meter(constraints.timeSignature)}.`
        : `Observed ${meter(facts.timeSignature)}; change the meter to ${meter(constraints.timeSignature)}.`,
    });
  }
  if (constraints.musicalKey) {
    const passed = facts.musicalKey === constraints.musicalKey;
    const observed = facts.musicalKey
      ? formatMusicalKey(facts.musicalKey)
      : "No key declared";
    const required = formatMusicalKey(constraints.musicalKey);
    rules.push({
      rule: "musical_key",
      passed,
      observed: facts.musicalKey,
      required: constraints.musicalKey,
      message: passed
        ? `Observed ${observed}; the required key is ${required}.`
        : `Observed ${observed}; declare the project key as ${required}.`,
    });
  }

  return challengeEvaluationV1Schema.parse({
    schemaVersion: 1,
    eligible: rules.every((rule) => rule.passed),
    facts,
    rules,
  });
}

function rangeRule(
  rule: "track_count" | "distinct_instrument_count" | "tempo_bpm",
  observed: number,
  required: NonNullable<CanonicalChallengeConstraintsV1["trackCount"]>,
  noun: string,
): EvaluationRule {
  const passed = inRange(observed, required);
  const requirement = rangeRequirement(required, noun);
  return {
    rule,
    passed,
    observed,
    required,
    message: passed
      ? `Observed ${observed} ${noun}${noun === "BPM" || observed === 1 ? "" : "s"}; requirement: ${requirement}.`
      : `Observed ${observed} ${noun}${noun === "BPM" || observed === 1 ? "" : "s"}; change the arrangement to ${requirement}.`,
  };
}

function inRange(
  value: number,
  range: {
    minimum: number | null;
    maximum: number | null;
    exact: number | null;
  },
) {
  if (range.exact !== null) return value === range.exact;
  return (
    (range.minimum === null || value >= range.minimum) &&
    (range.maximum === null || value <= range.maximum)
  );
}

function rangeRequirement(
  range: {
    minimum: number | null;
    maximum: number | null;
    exact: number | null;
  },
  noun: string,
) {
  const suffix = (value: number) =>
    `${noun}${noun === "BPM" || value === 1 ? "" : "s"}`;
  if (range.exact !== null)
    return `exactly ${range.exact} ${suffix(range.exact)}`;
  if (range.minimum !== null && range.maximum !== null)
    return `${range.minimum}–${range.maximum} ${suffix(range.maximum)}`;
  if (range.minimum !== null)
    return `at least ${range.minimum} ${suffix(range.minimum)}`;
  return `at most ${range.maximum} ${suffix(range.maximum!)}`;
}

function presetKey(preset: { presetId: string; version: number }) {
  return `${preset.presetId}@${preset.version}`;
}

function formatPresetList(
  presets: Array<{ presetId: string; version: number }>,
) {
  return presets
    .map((preset) => `${preset.presetId} v${preset.version}`)
    .join(", ");
}

function formatFamily(family: string) {
  return family.replaceAll("-", " ");
}

function meter(value: { numerator: number; denominator: number }) {
  return `${value.numerator}/${value.denominator}`;
}
