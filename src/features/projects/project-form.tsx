"use client";
import { useActionState } from "react";
import { formatMusicalKey } from "./musical-key";
import { musicalKeys } from "./schema";
import type { ProjectDetail, ProjectFormOptions } from "./types";
import type { ProjectFormState } from "./actions";

const inputClass =
  "focus:border-accent mt-2 min-h-11 w-full rounded-control border border-strong bg-surface px-3 py-2 transition-colors";
export function ProjectForm({
  action,
  options,
  project,
}: {
  action: (
    state: ProjectFormState,
    data: FormData,
  ) => Promise<ProjectFormState>;
  options: ProjectFormOptions;
  project?: ProjectDetail;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const selectedGenres = new Set(project?.genres.map((item) => item.id));
  const selectedTags = new Set(project?.tags.map((item) => item.id));
  return (
    <form
      action={formAction}
      className="mt-8 space-y-7"
      aria-describedby={state.message ? "project-form-error" : undefined}
    >
      {state.message && (
        <p
          id="project-form-error"
          role="alert"
          className="rounded-control border-danger text-danger border p-3"
        >
          {state.message}
        </p>
      )}
      <label className="block font-semibold">
        Title
        <input
          autoFocus={!project}
          className={inputClass}
          name="title"
          maxLength={120}
          defaultValue={project?.title ?? ""}
          aria-invalid={Boolean(state.fields?.title)}
        />
      </label>
      <label className="block font-semibold">
        Description{" "}
        <span className="text-muted text-sm font-normal">
          Plain text, up to 5,000 characters
        </span>
        <textarea
          className={`${inputClass} min-h-32`}
          name="description"
          maxLength={5000}
          defaultValue={project?.description ?? ""}
        />
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block font-semibold">
          BPM <span className="text-muted text-sm font-normal">Optional</span>
          <input
            className={inputClass}
            name="bpm"
            inputMode="decimal"
            defaultValue={project?.bpm ?? 120}
          />
        </label>
        <label className="block font-semibold">
          Musical key
          <select
            className={inputClass}
            name="musicalKey"
            defaultValue={project?.musicalKey ?? ""}
          >
            <option value="">Not set</option>
            {musicalKeys.map((key) => (
              <option key={key} value={key}>
                {formatMusicalKey(key)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset>
        <legend className="font-semibold">Time signature</legend>
        <div className="mt-2 flex items-center gap-3">
          <select
            aria-label="Time signature numerator"
            className={inputClass}
            name="timeSignatureNumerator"
            defaultValue={project?.timeSignature.numerator ?? 4}
          >
            {Array.from({ length: 32 }, (_, i) => i + 1).map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <span aria-hidden>/</span>
          <select
            aria-label="Time signature denominator"
            className={inputClass}
            name="timeSignatureDenominator"
            defaultValue={project?.timeSignature.denominator ?? 4}
          >
            {[1, 2, 4, 8, 16, 32].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </div>
      </fieldset>
      <label className="block font-semibold">
        License
        <select
          className={inputClass}
          name="licenseCode"
          defaultValue={project?.license.code ?? "all-rights-reserved"}
        >
          {options.licenses.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
        <span className="text-muted mt-2 block text-sm font-normal">
          Public visibility will not itself grant remix rights. License
          summaries are guidance, not legal advice.
        </span>
      </label>
      <fieldset>
        <legend className="font-semibold">
          Genres{" "}
          <span className="text-muted text-sm font-normal">Choose up to 3</span>
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {options.genres.map((item) => (
            <label
              key={item.id}
              className="rounded-control border-subtle hover:border-accent-2 flex min-h-11 items-center gap-3 border px-3 transition-colors"
            >
              <input
                type="checkbox"
                name="genreIds"
                value={item.id}
                defaultChecked={selectedGenres.has(item.id)}
              />
              {item.name}
              <input
                aria-label={`${item.name} as primary genre`}
                type="radio"
                name="primaryGenreId"
                value={item.id}
                defaultChecked={project?.genres.some(
                  (genre) => genre.id === item.id && genre.isPrimary,
                )}
              />
            </label>
          ))}
        </div>
        <input type="hidden" name="primaryGenreId" value="" />
      </fieldset>
      <fieldset>
        <legend className="font-semibold">
          Project tags{" "}
          <span className="text-muted text-sm font-normal">
            Choose up to 10
          </span>
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {options.tags.map((item) => (
            <label
              key={item.id}
              className="rounded-control border-subtle hover:border-accent-2 flex min-h-11 items-center gap-3 border px-3 transition-colors"
            >
              <input
                type="checkbox"
                name="tagIds"
                value={item.id}
                defaultChecked={selectedTags.has(item.id)}
              />
              {item.name}
            </label>
          ))}
        </div>
      </fieldset>
      <button
        disabled={pending}
        className="cta-gradient inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-semibold transition-transform duration-200 hover:-translate-y-px disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {pending
          ? "Saving…"
          : project
            ? "Save project"
            : "Create project and open Studio"}
      </button>
    </form>
  );
}
