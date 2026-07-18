"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useActionState, useState } from "react";
import {
  INSTRUMENT_FAMILIES,
  INSTRUMENT_PRESETS_CATALOG_1,
} from "@/features/midi/presets";
import { MIDI_V3_MAX_TEMPO_BPM } from "@/features/midi/domain-v3";
import { musicalKeys } from "@/features/projects/schema";
import {
  initialChallengeFormActionState,
  type ChallengeFormActionState,
} from "./action-state";
import { saveChallengeDraftAction } from "./actions";
import {
  canonicalizeChallengeConstraintsV1,
  describeChallengeConstraintsV1,
} from "./constraint-v1";
import {
  challengeVersionInputSchema,
  reviseChallengeInputSchema,
} from "./schema";

export type ChallengeFormDefaults = {
  slug: string;
  title: string;
  prompt: string;
  description: string;
  eligibilityTerms: string;
  presentationCode: "pulse" | "nocturne" | "sunrise";
  opensAt: string;
  submissionsCloseAt: string;
  votingOpensAt: string;
  votingClosesAt: string;
  resultsExpectedAt: string;
  judgingMode: "community" | "judged" | "hybrid";
  officialPlacementCount: number;
  starterProjectId: string | null;
  starterRevisionId: string | null;
  constraints: ReturnType<typeof canonicalizeChallengeConstraintsV1>;
  judges: Array<{
    role: "host" | "judge";
    displayName: string;
    profileId: string | null;
  }>;
};

type StarterOption = {
  projectId: string;
  revisionId: string;
  title: string;
  revisionNumber: number;
};

type ChallengeFormValue = Omit<ChallengeFormDefaults, "judges"> & {
  judges: Array<ChallengeFormDefaults["judges"][number] & { clientId: string }>;
};

type DraftAction = (
  state: ChallengeFormActionState,
  formData: FormData,
) => Promise<ChallengeFormActionState>;

export function AdminChallengeForm({
  mode,
  defaults,
  starters,
  challengeId,
  expectedLifecycleVersion,
  expectedCurrentVersionId,
  draftAction = saveChallengeDraftAction,
}: {
  mode: "create" | "revise";
  defaults: ChallengeFormDefaults;
  starters: StarterOption[];
  challengeId?: string;
  expectedLifecycleVersion?: number;
  expectedCurrentVersionId?: string;
  draftAction?: DraftAction;
}) {
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [value, setValue] = useState<ChallengeFormValue>(() => ({
    ...defaults,
    opensAt: toLocalDateTimeInput(defaults.opensAt),
    submissionsCloseAt: toLocalDateTimeInput(defaults.submissionsCloseAt),
    votingOpensAt: toLocalDateTimeInput(defaults.votingOpensAt),
    votingClosesAt: toLocalDateTimeInput(defaults.votingClosesAt),
    resultsExpectedAt: toLocalDateTimeInput(defaults.resultsExpectedAt),
    judges: defaults.judges.map((credit) => ({
      ...credit,
      clientId: crypto.randomUUID(),
    })),
  }));
  const [state, action, pending] = useActionState(
    async (previous: ChallengeFormActionState, formData: FormData) => {
      const next = await draftAction(previous, formData);
      if (next.status === "success") setRequestId(crypto.randomUUID());
      return next;
    },
    initialChallengeFormActionState,
  );
  const reducedMotion = useReducedMotion();
  const constraints = buildConstraints(value.constraints);
  const isoSchedule = scheduleToIso(value);
  const payload = {
    requestId,
    ...(mode === "create" ? { slug: value.slug } : {}),
    ...(mode === "revise"
      ? {
          challengeId,
          expectedLifecycleVersion,
          expectedCurrentVersionId,
        }
      : {}),
    title: value.title,
    prompt: value.prompt,
    description: value.description,
    eligibilityTerms: value.eligibilityTerms,
    presentationCode: value.presentationCode,
    ...isoSchedule,
    judgingMode: value.judgingMode,
    officialPlacementCount: Number(value.officialPlacementCount),
    starterProjectId: value.starterProjectId,
    starterRevisionId: value.starterRevisionId,
    constraints,
    judges: value.judges.map(({ role, displayName, profileId }) => ({
      role,
      displayName,
      profileId,
    })),
  };
  const parsed = (
    mode === "create" ? challengeVersionInputSchema : reviseChallengeInputSchema
  ).safeParse(payload);
  let preview: string[] = [];
  try {
    preview = describeChallengeConstraintsV1(constraints);
  } catch {
    // Field guidance below remains visible while a rule is incomplete.
  }
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function update<Key extends keyof ChallengeFormValue>(
    key: Key,
    next: ChallengeFormValue[Key],
  ) {
    setValue((current) => ({ ...current, [key]: next }));
  }

  return (
    <form action={action} className="mt-8 space-y-8">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />

      <FormSection title="Identity and invitation">
        <TextField
          label="Canonical slug"
          value={value.slug}
          onChange={(next) => update("slug", next.toLowerCase())}
          maxLength={80}
          disabled={mode === "revise"}
          help="Lowercase words joined with hyphens. The canonical URL never changes."
        />
        <TextField
          label="Challenge title"
          value={value.title}
          onChange={(next) => update("title", next)}
          maxLength={120}
        />
        <TextField
          label="Creative prompt"
          value={value.prompt}
          onChange={(next) => update("prompt", next)}
          maxLength={500}
        />
        <TextArea
          label="Description"
          value={value.description}
          onChange={(next) => update("description", next)}
          maxLength={5000}
        />
        <TextArea
          label="Eligibility and permitted-use terms"
          value={value.eligibilityTerms}
          onChange={(next) => update("eligibilityTerms", next)}
          maxLength={2000}
        />
        <SelectField
          label="Presentation"
          value={value.presentationCode}
          onChange={(next) =>
            update(
              "presentationCode",
              next as ChallengeFormDefaults["presentationCode"],
            )
          }
          options={[
            ["pulse", "Pulse"],
            ["nocturne", "Nocturne"],
            ["sunrise", "Sunrise"],
          ]}
        />
      </FormSection>

      <FormSection title="UTC lifecycle schedule">
        <p className="text-muted sm:col-span-2">
          Times are entered in {timezone} and stored as exact UTC instants.
          Phases derive from these boundaries; no scheduler changes them.
        </p>
        {(
          [
            ["opensAt", "Opens"],
            ["submissionsCloseAt", "Submissions close"],
            ["votingOpensAt", "Voting opens"],
            ["votingClosesAt", "Voting closes"],
            ["resultsExpectedAt", "Results expected"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="grid gap-2 text-sm font-semibold">
            {label}
            <input
              type="datetime-local"
              value={value[key]}
              onChange={(event) => update(key, event.target.value)}
              className="border-strong bg-canvas rounded-control min-h-11 border px-4"
            />
            <span className="text-muted font-normal">
              UTC: {isoSchedule[key] || "Choose a valid time"}
            </span>
          </label>
        ))}
      </FormSection>

      <FormSection title="Machine-checkable boundaries">
        <RangeControls
          label="Track count"
          value={value.constraints.trackCount}
          onChange={(next) =>
            update("constraints", { ...value.constraints, trackCount: next })
          }
        />
        <RangeControls
          label="Distinct instruments"
          value={value.constraints.distinctInstrumentCount}
          onChange={(next) =>
            update("constraints", {
              ...value.constraints,
              distinctInstrumentCount: next,
            })
          }
        />
        <RangeControls
          label="Tempo (BPM)"
          value={value.constraints.tempoBpm}
          onChange={(next) =>
            update("constraints", { ...value.constraints, tempoBpm: next })
          }
          step="0.001"
          minimum={20}
          maximum={MIDI_V3_MAX_TEMPO_BPM}
          initialExact={120}
        />
        <TimeSignatureControls
          value={value.constraints.timeSignature}
          onChange={(next) =>
            update("constraints", {
              ...value.constraints,
              timeSignature: next,
            })
          }
        />
        <SelectField
          label="Declared musical key"
          value={value.constraints.musicalKey ?? ""}
          onChange={(next) =>
            update("constraints", {
              ...value.constraints,
              musicalKey: next ? (next as (typeof musicalKeys)[number]) : null,
            })
          }
          options={[
            ["", "No key rule"],
            ...musicalKeys.map(
              (key) => [key, key.replaceAll("-", " ")] as const,
            ),
          ]}
        />
      </FormSection>

      <FormSection title="Instrument rules">
        <InstrumentChecks
          label="Allowed families (union)"
          values={value.constraints.instruments?.allowedFamilies ?? []}
          choices={INSTRUMENT_FAMILIES.map((family) => ({
            value: family,
            label: family.replaceAll("-", " "),
          }))}
          onChange={(items) =>
            update(
              "constraints",
              setInstrumentList(value.constraints, "allowedFamilies", items),
            )
          }
        />
        <InstrumentChecks
          label="Required families (cumulative)"
          values={value.constraints.instruments?.requiredFamilies ?? []}
          choices={INSTRUMENT_FAMILIES.map((family) => ({
            value: family,
            label: family.replaceAll("-", " "),
          }))}
          onChange={(items) =>
            update(
              "constraints",
              setInstrumentList(value.constraints, "requiredFamilies", items),
            )
          }
        />
        <InstrumentChecks
          label="Allowed exact presets (union)"
          values={(
            value.constraints.instruments?.allowedPresetVersions ?? []
          ).map((preset) => `${preset.presetId}@${preset.version}`)}
          choices={INSTRUMENT_PRESETS_CATALOG_1.map((preset) => ({
            value: `${preset.presetId}@${preset.version}`,
            label: `${preset.name} v${preset.version}`,
          }))}
          onChange={(items) =>
            update(
              "constraints",
              setPresetList(value.constraints, "allowedPresetVersions", items),
            )
          }
        />
        <InstrumentChecks
          label="Required exact presets (cumulative)"
          values={(
            value.constraints.instruments?.requiredPresetVersions ?? []
          ).map((preset) => `${preset.presetId}@${preset.version}`)}
          choices={INSTRUMENT_PRESETS_CATALOG_1.map((preset) => ({
            value: `${preset.presetId}@${preset.version}`,
            label: `${preset.name} v${preset.version}`,
          }))}
          onChange={(items) =>
            update(
              "constraints",
              setPresetList(value.constraints, "requiredPresetVersions", items),
            )
          }
        />
      </FormSection>

      <FormSection title="Judging and immutable credits">
        <SelectField
          label="Judging mode"
          value={value.judgingMode}
          onChange={(next) =>
            update("judgingMode", next as ChallengeFormDefaults["judgingMode"])
          }
          options={[
            ["community", "Community"],
            ["judged", "Judged"],
            ["hybrid", "Hybrid"],
          ]}
        />
        <NumberField
          label="Official placement count"
          value={value.officialPlacementCount}
          min={0}
          max={20}
          onChange={(next) => update("officialPlacementCount", next)}
        />
        <div className="space-y-4 sm:col-span-2">
          {value.judges.map((credit, index) => (
            <div
              key={credit.clientId}
              className="border-subtle rounded-control grid gap-3 border p-4 sm:grid-cols-[9rem_1fr_1fr_auto]"
            >
              <SelectField
                label={`Credit ${index + 1} role`}
                value={credit.role}
                onChange={(next) =>
                  updateJudge(
                    value,
                    index,
                    { ...credit, role: next as "host" | "judge" },
                    update,
                  )
                }
                options={[
                  ["host", "Host"],
                  ["judge", "Judge"],
                ]}
              />
              <TextField
                label="Display name"
                value={credit.displayName}
                onChange={(next) =>
                  updateJudge(
                    value,
                    index,
                    { ...credit, displayName: next },
                    update,
                  )
                }
                maxLength={120}
              />
              <TextField
                label="Profile ID (optional)"
                value={credit.profileId ?? ""}
                onChange={(next) =>
                  updateJudge(
                    value,
                    index,
                    { ...credit, profileId: next || null },
                    update,
                  )
                }
                maxLength={36}
              />
              <button
                type="button"
                disabled={value.judges.length === 1}
                onClick={() =>
                  update(
                    "judges",
                    value.judges.filter((_, position) => position !== index),
                  )
                }
                className="border-danger text-danger mt-7 min-h-11 rounded-full border px-4 disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={value.judges.length >= 10}
            onClick={() =>
              update("judges", [
                ...value.judges,
                {
                  role: "judge",
                  displayName: "",
                  profileId: null,
                  clientId: crypto.randomUUID(),
                },
              ])
            }
            className="border-strong min-h-11 rounded-full border px-5 font-semibold"
          >
            Add credit
          </button>
        </div>
      </FormSection>

      <FormSection title="Optional exact reusable starter">
        <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
          Public project revision
          <select
            value={value.starterRevisionId ?? ""}
            onChange={(event) => {
              const starter = starters.find(
                (candidate) => candidate.revisionId === event.target.value,
              );
              update("starterProjectId", starter?.projectId ?? null);
              update("starterRevisionId", starter?.revisionId ?? null);
            }}
            className="border-strong bg-canvas rounded-control min-h-11 border px-4"
          >
            <option value="">No starter</option>
            {starters.map((starter) => (
              <option key={starter.revisionId} value={starter.revisionId}>
                {starter.title} · revision {starter.revisionNumber}
              </option>
            ))}
          </select>
          <span className="text-muted font-normal">
            Only exact, currently public CC BY 4.0 revisions appear. Publication
            revalidates availability and reusable rights.
          </span>
        </label>
      </FormSection>

      <section
        className="border-accent bg-surface rounded-card border p-6"
        aria-labelledby="rules-preview-heading"
      >
        <h2 id="rules-preview-heading" className="text-2xl font-bold">
          Generated rules preview
        </h2>
        {preview.length ? (
          <ol className="mt-4 list-decimal space-y-2 pl-5">
            {preview.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
        ) : (
          <p className="text-danger mt-3">
            Add one complete machine-checkable rule to continue.
          </p>
        )}
      </section>

      {!parsed.success && (
        <p role="alert" className="text-danger">
          {parsed.error.issues[0]?.message ?? "Complete the challenge fields."}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || !parsed.success}
        className="cta-gradient text-accent-contrast min-h-12 rounded-full px-7 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending
          ? "Saving…"
          : mode === "create"
            ? "Create challenge draft"
            : "Append revised version"}
      </button>

      <AnimatePresence mode="wait" initial={false}>
        {state.status !== "idle" && (
          <motion.div
            key={`${state.status}-${state.message}`}
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
            role={state.status === "success" ? "status" : "alert"}
            className={`rounded-control border p-4 ${state.status === "success" ? "border-accent" : "border-danger text-danger"}`}
          >
            {state.message}{" "}
            {state.challengeId && (
              <Link
                className="ml-2 underline"
                href={`/admin/challenges/${state.challengeId}`}
              >
                Open challenge
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="border-subtle bg-surface rounded-card grid gap-5 border p-5 sm:grid-cols-2">
      <legend className="px-2 text-xl font-bold">{title}</legend>
      {children}
    </fieldset>
  );
}
function TextField({
  label,
  value,
  onChange,
  maxLength,
  disabled = false,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  disabled?: boolean;
  help?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      <input
        value={value}
        disabled={disabled}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="border-strong bg-canvas rounded-control min-h-11 border px-4 disabled:opacity-60"
      />
      {help && <span className="text-muted font-normal">{help}</span>}
    </label>
  );
}
function TextArea({
  label,
  value,
  onChange,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
      {label}
      <textarea
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="border-strong bg-canvas rounded-control min-h-28 border p-4"
      />
    </label>
  );
}
function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: (readonly [string, string])[];
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-strong bg-canvas rounded-control min-h-11 border px-4"
      >
        {options.map(([option, labelText]) => (
          <option key={option} value={option}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}
function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(Number(event.target.value))}
        className="border-strong bg-canvas rounded-control min-h-11 border px-4"
      />
    </label>
  );
}
function RangeControls({
  label,
  value,
  onChange,
  step = "1",
  minimum = 0,
  maximum = 32,
  initialExact = 1,
}: {
  label: string;
  value: {
    minimum: number | null;
    maximum: number | null;
    exact: number | null;
  } | null;
  onChange: (
    value: {
      minimum: number | null;
      maximum: number | null;
      exact: number | null;
    } | null,
  ) => void;
  step?: string;
  minimum?: number;
  maximum?: number;
  initialExact?: number;
}) {
  return (
    <fieldset className="border-subtle rounded-control border p-4">
      <legend className="px-2 text-sm font-semibold">{label}</legend>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) =>
            onChange(
              event.target.checked
                ? { minimum: null, maximum: null, exact: initialExact }
                : null,
            )
          }
        />
        Enable rule
      </label>
      {value && (
        <div className="grid grid-cols-3 gap-2">
          {(["minimum", "maximum", "exact"] as const).map((key) => (
            <label key={key} className="grid gap-1 text-xs capitalize">
              {key}
              <input
                type="number"
                step={step}
                min={minimum}
                max={maximum}
                value={value[key] ?? ""}
                onChange={(event) =>
                  onChange({
                    ...value,
                    [key]:
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                  })
                }
                className="border-strong bg-canvas rounded-control min-h-10 border px-2"
              />
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

const timeSignatureDenominators = [1, 2, 4, 8, 16, 32] as const;

function TimeSignatureControls({
  value,
  onChange,
}: {
  value: ChallengeFormDefaults["constraints"]["timeSignature"];
  onChange: (
    value: ChallengeFormDefaults["constraints"]["timeSignature"],
  ) => void;
}) {
  return (
    <fieldset className="border-subtle rounded-control border p-4">
      <legend className="px-2 text-sm font-semibold">Time signature</legend>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) =>
            onChange(
              event.target.checked ? { numerator: 4, denominator: 4 } : null,
            )
          }
        />
        Enable meter rule
      </label>
      {value && (
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-xs">
            Numerator
            <input
              aria-label="Time signature numerator"
              type="number"
              min={1}
              max={32}
              value={value.numerator}
              onChange={(event) =>
                onChange({ ...value, numerator: Number(event.target.value) })
              }
              className="border-strong bg-canvas rounded-control min-h-10 border px-2"
            />
          </label>
          <label className="grid gap-1 text-xs">
            Denominator
            <select
              aria-label="Time signature denominator"
              value={value.denominator}
              onChange={(event) =>
                onChange({
                  ...value,
                  denominator: Number(
                    event.target.value,
                  ) as (typeof timeSignatureDenominators)[number],
                })
              }
              className="border-strong bg-canvas rounded-control min-h-10 border px-2"
            >
              {timeSignatureDenominators.map((denominator) => (
                <option key={denominator} value={denominator}>
                  {denominator}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </fieldset>
  );
}
function InstrumentChecks({
  label,
  values,
  choices,
  onChange,
}: {
  label: string;
  values: string[];
  choices: Array<{ value: string; label: string }>;
  onChange: (values: string[]) => void;
}) {
  return (
    <fieldset className="border-subtle rounded-control max-h-72 overflow-auto border p-4">
      <legend className="px-2 text-sm font-semibold">{label}</legend>
      <div className="grid gap-2">
        {choices.map((choice) => (
          <label key={choice.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.includes(choice.value)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...values, choice.value]
                    : values.filter((value) => value !== choice.value),
                )
              }
            />
            {choice.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
function buildConstraints(value: ChallengeFormDefaults["constraints"]) {
  return {
    ...value,
    schemaVersion: 1 as const,
    instruments:
      value.instruments &&
      Object.values(value.instruments).some((items) => items.length)
        ? value.instruments
        : null,
  };
}
function setInstrumentList(
  value: ChallengeFormDefaults["constraints"],
  key: "allowedFamilies" | "requiredFamilies",
  items: string[],
) {
  const instruments = value.instruments ?? {
    allowedPresetVersions: [],
    requiredPresetVersions: [],
    allowedFamilies: [],
    requiredFamilies: [],
  };
  return {
    ...value,
    instruments: { ...instruments, [key]: items },
  } as ChallengeFormDefaults["constraints"];
}
function setPresetList(
  value: ChallengeFormDefaults["constraints"],
  key: "allowedPresetVersions" | "requiredPresetVersions",
  items: string[],
) {
  const instruments = value.instruments ?? {
    allowedPresetVersions: [],
    requiredPresetVersions: [],
    allowedFamilies: [],
    requiredFamilies: [],
  };
  return {
    ...value,
    instruments: {
      ...instruments,
      [key]: items.map((item) => {
        const [presetId, version] = item.split("@");
        return { presetId: presetId!, version: Number(version) };
      }),
    },
  } as ChallengeFormDefaults["constraints"];
}
function updateJudge(
  value: ChallengeFormValue,
  index: number,
  credit: ChallengeFormValue["judges"][number],
  update: <Key extends keyof ChallengeFormValue>(
    key: Key,
    next: ChallengeFormValue[Key],
  ) => void,
) {
  update(
    "judges",
    value.judges.map((item, position) => (position === index ? credit : item)),
  );
}
function scheduleToIso(value: ChallengeFormDefaults) {
  return {
    opensAt: toIso(value.opensAt),
    submissionsCloseAt: toIso(value.submissionsCloseAt),
    votingOpensAt: toIso(value.votingOpensAt),
    votingClosesAt: toIso(value.votingClosesAt),
    resultsExpectedAt: toIso(value.resultsExpectedAt),
  };
}
function toIso(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

export function toLocalDateTimeInput(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
