"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import {
  listMidiLibraryAction,
  unlistMidiLibraryAction,
  type MidiLibraryActionResult,
} from "./actions";
import { MIDI_LIBRARY_RIGHTS_LABELS } from "./rights";
import type { MidiLibraryOptions, OwnedMidiLibraryVersion } from "./types";

type Basis =
  "original" | "authorized_adaptation" | "public_domain" | "uncertain";
type Credit = {
  creditedName: string;
  role: string;
  workTitle: string;
  sourceUrl: string;
  sourceTerms: string;
  attributionNote: string;
};
const blankCredit = (): Credit => ({
  creditedName: "",
  role: "",
  workTitle: "",
  sourceUrl: "",
  sourceTerms: "",
  attributionNote: "",
});

export function MidiLibraryListingManager({
  versions,
  options,
}: {
  versions: OwnedMidiLibraryVersion[];
  options: MidiLibraryOptions;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(
    versions[0]?.patternVersionId ?? "",
  );
  const selected =
    versions.find((version) => version.patternVersionId === selectedId) ?? null;
  const [reuseMode, setReuseMode] = useState<
    "commercial_reuse" | "reference_only"
  >(selected?.reuseLicenseCode ? "commercial_reuse" : "reference_only");
  const [basis, setBasis] = useState<Basis>(
    versions[0]?.hasSourceLineage ? "authorized_adaptation" : "original",
  );
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(options.categories[0]?.code ?? "");
  const [preset, setPreset] = useState(options.presets[0]?.id ?? "");
  const [tags, setTags] = useState<string[]>([]);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceTerms, setSourceTerms] = useState("");
  const [rationale, setRationale] = useState("");
  const [credits, setCredits] = useState<Credit[]>([blankCredit()]);
  const [affirmed, setAffirmed] = useState(false);
  const [result, setResult] = useState<MidiLibraryActionResult | null>(null);
  const requestId = useRef<string | null>(null);
  const activeListings = useMemo(() => {
    const byId = new Map<
      string,
      {
        listingId: string;
        patternName: string;
        reuseMode: "commercial_reuse" | "reference_only";
        creatorVersion: number;
      }
    >();
    for (const version of versions)
      if (
        version.activeListingId &&
        version.activeCreatorVersion &&
        version.activeReuseMode
      )
        byId.set(version.activeListingId, {
          listingId: version.activeListingId,
          patternName: version.patternName,
          reuseMode: version.activeReuseMode,
          creatorVersion: version.activeCreatorVersion,
        });
    return [...byId.values()];
  }, [versions]);
  const uncertain = basis === "uncertain";
  const alreadyActive =
    selected?.activeListingPatternVersionId === selected?.patternVersionId;
  function selectVersion(id: string) {
    const next = versions.find((version) => version.patternVersionId === id);
    setSelectedId(id);
    setReuseMode(
      next?.reuseLicenseCode ? "commercial_reuse" : "reference_only",
    );
    setBasis(next?.hasSourceLineage ? "authorized_adaptation" : "original");
    setResult(null);
  }
  function updateCredit(index: number, key: keyof Credit, value: string) {
    setCredits((current) =>
      current.map((credit, position) =>
        position === index ? { ...credit, [key]: value } : credit,
      ),
    );
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || uncertain || alreadyActive || !affirmed) return;
    const externalCredits = credits
      .filter((credit) => credit.creditedName || credit.role)
      .map((credit) =>
        Object.fromEntries(
          Object.entries(credit).filter(([, value]) => value !== ""),
        ),
      );
    requestId.current ??= crypto.randomUUID();
    startTransition(async () => {
      const next = await listMidiLibraryAction({
        patternVersionId: selected.patternVersionId,
        requestId: requestId.current,
        reuseMode,
        rightsBasis: basis,
        attestationVersion:
          reuseMode === "commercial_reuse"
            ? "midi-library-commercial-attestation-v1"
            : "midi-library-reference-display-attestation-v1",
        description,
        supportingSourceUrl: basis === "original" ? null : sourceUrl || null,
        supportingSourceTerms:
          basis === "authorized_adaptation" ? sourceTerms || null : null,
        publicDomainRationale:
          basis === "public_domain" ? rationale || null : null,
        categoryCode: category,
        suggestedPresetId: preset,
        suggestedPresetVersion: 1,
        tags,
        externalCredits,
        hasSourceLineage: selected.hasSourceLineage,
        hasInheritedExternalCredits: selected.hasInheritedExternalCredits,
        replaceListingId:
          selected.activeListingId &&
          selected.activeListingPatternVersionId !== selected.patternVersionId
            ? selected.activeListingId
            : null,
      });
      setResult(next);
      if (next.ok) {
        requestId.current = null;
        router.refresh();
      }
    });
  }
  function unlist(listingId: string, creatorVersion: number) {
    startTransition(async () => {
      const next = await unlistMidiLibraryAction({
        listingId,
        requestId: crypto.randomUUID(),
        expectedCreatorVersion: creatorVersion,
      });
      setResult(next);
      if (next.ok) router.refresh();
    });
  }
  if (!versions.length)
    return (
      <section className="rounded-card border-subtle border border-dashed p-8">
        <h2 className="text-2xl font-bold">Freeze a pattern first.</h2>
        <p className="text-muted mt-2">
          Create an immutable pattern version in Studio, then return here to
          choose its public rights mode.
        </p>
      </section>
    );
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <form onSubmit={submit} className="space-y-8">
        <FormSection title="1 · Exact pattern version">
          <label className="field-label">
            Pattern version
            <select
              aria-label="Pattern version"
              className="field-input"
              value={selectedId}
              onChange={(event) => selectVersion(event.target.value)}
            >
              {versions.map((version) => (
                <option
                  key={version.patternVersionId}
                  value={version.patternVersionId}
                >
                  {version.patternName} · version {version.versionNumber} ·{" "}
                  {version.noteCount} notes
                </option>
              ))}
            </select>
          </label>
          {alreadyActive && (
            <p className="text-accent-2 mt-3 text-sm">
              This exact version is already the active listing edition.
            </p>
          )}
          {selected?.activeListingId && !alreadyActive && (
            <p className="text-muted mt-3 text-sm">
              Listing this newer exact version will close the pattern’s current
              edition in the same transaction.
            </p>
          )}
        </FormSection>
        <FormSection title="2 · Reuse mode">
          <fieldset>
            <legend className="sr-only">Reuse mode</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Choice
                checked={reuseMode === "commercial_reuse"}
                disabled={!selected?.reuseLicenseCode}
                onChange={() => setReuseMode("commercial_reuse")}
                title={MIDI_LIBRARY_RIGHTS_LABELS.commercial_reuse}
              >
                Allows downstream reuse with attribution. This exact version
                must already carry CC BY 4.0.
              </Choice>
              <Choice
                checked={reuseMode === "reference_only"}
                disabled={Boolean(selected?.reuseLicenseCode)}
                onChange={() => setReuseMode("reference_only")}
                title={MIDI_LIBRARY_RIGHTS_LABELS.reference_only}
              >
                Allows listening and inspection only—never save, import, fork,
                edit, or export.
              </Choice>
            </div>
          </fieldset>
        </FormSection>
        <FormSection title="3 · Rights basis">
          <fieldset>
            <legend className="sr-only">Rights basis</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                [
                  "original",
                  "Wholly original",
                  "I control the material and may publish it in this mode.",
                ],
                [
                  "authorized_adaptation",
                  "Authorized adaptation",
                  "I have source terms or permission compatible with this mode.",
                ],
                [
                  "public_domain",
                  "Public domain",
                  "I can record a source and public-domain rationale.",
                ],
                [
                  "uncertain",
                  "Cover, recreation, or unsure about rights",
                  "Keep this pattern private. Reference-only and credit do not create permission.",
                ],
              ].map(([value, title, copy]) => (
                <Choice
                  key={value}
                  checked={basis === value}
                  disabled={Boolean(
                    selected?.hasSourceLineage &&
                    value !== "authorized_adaptation",
                  )}
                  onChange={() => setBasis(value as Basis)}
                  title={title}
                >
                  {copy}
                </Choice>
              ))}
            </div>
          </fieldset>
          {selected?.hasSourceLineage && (
            <p className="border-accent/40 bg-surface-soft rounded-card mt-4 border p-4 text-sm">
              This pattern has verified OpenMIDI source lineage. Its rights
              basis must remain an authorized adaptation.
              {selected.hasInheritedExternalCredits
                ? " Inherited external credits will be carried into the new listing automatically."
                : " No inherited external credits are recorded, so add the required source credit below."}
            </p>
          )}
          {uncertain && (
            <div
              className="border-danger/40 bg-surface-soft text-danger rounded-card mt-4 border p-4"
              role="alert"
            >
              <strong>This pattern cannot enter either public mode.</strong>
              <p className="mt-1 text-sm">
                Keep it private until you can confirm authority for the selected
                display or reuse terms.
              </p>
            </div>
          )}
          {(basis === "authorized_adaptation" || basis === "public_domain") && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="field-label">
                HTTPS source
                <input
                  className="field-input"
                  type="url"
                  required
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://…"
                />
              </label>
              {basis === "authorized_adaptation" ? (
                <label className="field-label">
                  Permission or source terms
                  <textarea
                    className="field-input min-h-28"
                    required
                    maxLength={500}
                    value={sourceTerms}
                    onChange={(event) => setSourceTerms(event.target.value)}
                  />
                </label>
              ) : (
                <label className="field-label">
                  Public-domain rationale
                  <textarea
                    className="field-input min-h-28"
                    required
                    maxLength={500}
                    value={rationale}
                    onChange={(event) => setRationale(event.target.value)}
                  />
                </label>
              )}
            </div>
          )}
        </FormSection>
        <FormSection title="4 · Musical catalog">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field-label">
              Category
              <select
                className="field-input"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {options.categories.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Suggested bundled preset
              <select
                className="field-input"
                value={preset}
                onChange={(event) => setPreset(event.target.value)}
              >
                {options.presets.map((item) => (
                  <option key={`${item.id}-${item.version}`} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="mt-4">
            <legend className="field-label">Tags · choose up to 8</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {options.tags.map((tag) => (
                <label
                  key={tag.code}
                  className="border-strong hover:border-accent-2 rounded-full border px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={tags.includes(tag.code)}
                    disabled={!tags.includes(tag.code) && tags.length >= 8}
                    onChange={(event) =>
                      setTags((current) =>
                        event.target.checked
                          ? [...current, tag.code]
                          : current.filter((code) => code !== tag.code),
                      )
                    }
                  />
                  {tag.name}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="field-label mt-4">
            Listing note
            <textarea
              className="field-input min-h-28"
              maxLength={1000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What makes this pattern useful or interesting?"
            />
          </label>
        </FormSection>
        <FormSection title="5 · External credits">
          <p className="text-muted text-sm">
            External credits stay separate from verified OpenMIDI lineage.
            Credit acknowledges a source; it is not proof of permission.
          </p>
          {credits.map((credit, index) => (
            <div
              className="border-subtle rounded-card mt-4 grid gap-3 border p-4 sm:grid-cols-2"
              key={index}
            >
              <label className="field-label">
                Credited name
                <input
                  className="field-input"
                  value={credit.creditedName}
                  onChange={(event) =>
                    updateCredit(index, "creditedName", event.target.value)
                  }
                  required={
                    basis !== "original" &&
                    !selected?.hasInheritedExternalCredits
                  }
                />
              </label>
              <label className="field-label">
                Role
                <input
                  className="field-input"
                  value={credit.role}
                  onChange={(event) =>
                    updateCredit(index, "role", event.target.value)
                  }
                  required={
                    basis !== "original" &&
                    !selected?.hasInheritedExternalCredits
                  }
                />
              </label>
              <label className="field-label">
                Work title
                <input
                  className="field-input"
                  value={credit.workTitle}
                  onChange={(event) =>
                    updateCredit(index, "workTitle", event.target.value)
                  }
                />
              </label>
              <label className="field-label">
                HTTPS source
                <input
                  className="field-input"
                  type="url"
                  value={credit.sourceUrl}
                  onChange={(event) =>
                    updateCredit(index, "sourceUrl", event.target.value)
                  }
                />
              </label>
              <label className="field-label">
                Source terms
                <input
                  className="field-input"
                  value={credit.sourceTerms}
                  onChange={(event) =>
                    updateCredit(index, "sourceTerms", event.target.value)
                  }
                />
              </label>
              <label className="field-label">
                Attribution note
                <input
                  className="field-input"
                  value={credit.attributionNote}
                  onChange={(event) =>
                    updateCredit(index, "attributionNote", event.target.value)
                  }
                />
              </label>
              {credits.length > 1 && (
                <button
                  type="button"
                  className="text-danger inline-flex items-center gap-2 text-sm"
                  onClick={() =>
                    setCredits((current) =>
                      current.filter((_, position) => position !== index),
                    )
                  }
                >
                  <FiTrash2 aria-hidden="true" />
                  Remove credit
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            disabled={credits.length >= 12}
            onClick={() => setCredits((current) => [...current, blankCredit()])}
            className="border-strong hover:border-accent-2 mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold"
          >
            <FiPlus aria-hidden="true" />
            Add credit
          </button>
        </FormSection>
        <FormSection title="6 · Confirm">
          <label className="flex gap-3">
            <input
              type="checkbox"
              checked={affirmed}
              onChange={(event) => setAffirmed(event.target.checked)}
            />
            <span>
              I affirm this rights basis and my authority for the selected
              public mode. I understand OpenMIDI has not verified ownership.
            </span>
          </label>
          {result && (
            <p
              className={`mt-4 text-sm ${result.ok ? "text-accent-2" : "text-danger"}`}
              role="status"
            >
              {result.message}
            </p>
          )}
          <button
            disabled={pending || uncertain || alreadyActive || !affirmed}
            className="cta-gradient text-accent-contrast mt-5 min-h-11 rounded-full px-6 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending
              ? "Publishing…"
              : selected?.activeListingId
                ? "Publish replacement edition"
                : "Publish listing"}
          </button>
        </FormSection>
      </form>
      <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
        <section className="rounded-card border-subtle bg-surface-raised border p-5">
          <p className="text-accent font-mono text-[11px] tracking-[.16em] uppercase">
            Confirmation summary
          </p>
          <h2 className="mt-3 text-xl font-bold">{selected?.patternName}</h2>
          <dl className="text-muted mt-4 space-y-3 text-sm">
            <Summary
              label="Exact version"
              value={selected ? `Version ${selected.versionNumber}` : "—"}
            />
            <Summary
              label="Public mode"
              value={MIDI_LIBRARY_RIGHTS_LABELS[reuseMode]}
            />
            <Summary label="Rights basis" value={basis.replaceAll("_", " ")} />
            <Summary
              label="Preset"
              value={
                options.presets.find((item) => item.id === preset)?.name ?? "—"
              }
            />
            <Summary
              label="Credits"
              value={String(
                credits.filter((credit) => credit.creditedName || credit.role)
                  .length,
              )}
            />
          </dl>
        </section>
        {activeListings.length > 0 && (
          <section className="rounded-card border-subtle bg-surface border p-5">
            <h2 className="text-lg font-bold">Active editions</h2>
            {activeListings.map((listing) => (
              <div
                className="border-subtle mt-4 border-t pt-4"
                key={listing.listingId}
              >
                <p className="font-semibold">{listing.patternName}</p>
                <p className="text-muted mt-1 text-xs">
                  {MIDI_LIBRARY_RIGHTS_LABELS[listing.reuseMode]}
                </p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    unlist(listing.listingId, listing.creatorVersion)
                  }
                  className="border-strong hover:border-accent mt-3 min-h-10 rounded-full border px-4 text-sm font-semibold"
                >
                  Unlist
                </button>
              </div>
            ))}
          </section>
        )}
      </aside>
    </div>
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
    <section className="rounded-card border-subtle bg-surface border p-5 sm:p-6">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}
function Choice({
  checked,
  disabled = false,
  onChange,
  title,
  children,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`rounded-card border p-4 transition-colors ${checked ? "border-accent bg-surface-raised" : "border-subtle hover:border-accent-2"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span className="flex items-start gap-3">
        <input
          type="radio"
          checked={checked}
          disabled={disabled}
          onChange={onChange}
        />
        <span>
          <strong className="block">{title}</strong>
          <span className="text-muted mt-1 block text-sm">{children}</span>
        </span>
      </span>
    </label>
  );
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] tracking-wider uppercase">
        {label}
      </dt>
      <dd className="text-ink mt-1 capitalize">{value}</dd>
    </div>
  );
}
