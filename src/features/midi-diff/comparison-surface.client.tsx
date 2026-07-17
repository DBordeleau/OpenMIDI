"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { MidiSemanticDiffV1 } from "@/features/midi/semantic-diff-v1";
import type { MidiDiffAuditionSide } from "./paired-audition.client";
import { MidiDiffComparisonNavigator } from "./comparison-navigator.client";
import { createMidiDiffViewModel } from "./view-model";

const MidiDiffPairedAudition = dynamic(
  () =>
    import("./paired-audition.client").then(
      (module) => module.MidiDiffPairedAudition,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="border-subtle bg-surface rounded-card mt-5 border p-5"
        role="status"
      >
        Loading read-only audition controls…
      </div>
    ),
  },
);

export type MidiDiffComparisonSurfaceProps = {
  before: MidiDiffAuditionSide;
  after: MidiDiffAuditionSide;
  semanticDiff: MidiSemanticDiffV1;
  sideLabels: { before: string; after: string };
  eyebrow: string;
  heading: string;
  description: string;
  unchangedTitle: string;
  unchangedMessage: string;
  technicalIds: Array<{ label: string; value: string }>;
};

function ComparisonState({ kind }: { kind: "unavailable" | "inconsistent" }) {
  const inconsistent = kind === "inconsistent";
  return (
    <div className="rounded-card border-subtle mt-4 border border-dashed p-6">
      <h3 className="text-lg font-bold">
        {inconsistent ? "Comparison needs attention" : "Comparison unavailable"}
      </h3>
      <p className="text-muted mt-2">
        {inconsistent
          ? "The immutable comparison data is inconsistent, so OpenMIDI will not guess at what changed. Reload this page; if this continues, report it for investigation."
          : "One of the exact immutable arrangements is unavailable. Reload this page or choose another revision pair."}
      </p>
    </div>
  );
}

export function MidiDiffComparisonSurface({
  before,
  after,
  semanticDiff,
  sideLabels,
  eyebrow,
  heading,
  description,
  unchangedTitle,
  unchangedMessage,
  technicalIds,
}: MidiDiffComparisonSurfaceProps) {
  const model = useMemo(
    () =>
      createMidiDiffViewModel({
        semanticDiff,
        before,
        after,
        sideLabels,
      }),
    [after, before, semanticDiff, sideLabels],
  );
  const [selectedObject, setSelectedObject] = useState<string | null>(null);

  if (model.status === "unavailable" || model.status === "inconsistent") {
    return <ComparisonState kind={model.status} />;
  }

  return (
    <section className="mt-8" aria-labelledby="comparison-heading">
      <p className="text-accent-2 font-mono text-xs font-semibold tracking-[0.18em] uppercase">
        {eyebrow}
      </p>
      <h2 id="comparison-heading" className="mt-2 text-3xl font-bold">
        {heading}
      </h2>
      <p className="text-muted mt-2">{description}</p>

      <MidiDiffPairedAudition
        after={after}
        before={before}
        selectionKey={
          selectedObject ??
          (model.status === "ready"
            ? (model.defaultSelectionId ?? "arrangement")
            : "unchanged")
        }
        sideLabels={sideLabels}
      />

      {model.status === "unchanged" ? (
        <div
          className="rounded-card border-subtle mt-6 border border-dashed p-6"
          role="status"
        >
          <h3 className="text-xl font-bold">{unchangedTitle}</h3>
          <p className="text-muted mt-2">{unchangedMessage}</p>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-semibold">
              Technical comparison details
            </summary>
            <p className="text-muted mt-2">
              Compared with <code>{model.algorithmVersion}</code>.
            </p>
          </details>
        </div>
      ) : (
        <>
          <section className="mt-8" aria-labelledby="change-summary-heading">
            <h3 id="change-summary-heading" className="text-2xl font-bold">
              What changed
            </h3>
            <p className="text-muted mt-2">
              {model.summary.arrangementFields} arrangement fields ·{" "}
              {model.summary.tracks} tracks · {model.summary.clips} clips ·{" "}
              {model.summary.uniqueNotes} unique notes · {model.summary.lineage}{" "}
              lineage relationships
            </p>
            <MidiDiffComparisonNavigator
              model={model}
              onSelectionChange={setSelectedObject}
            />
          </section>

          <section className="mt-8" aria-labelledby="arrangement-heading">
            <h3 id="arrangement-heading" className="text-xl font-bold">
              Arrangement metadata
            </h3>
            {model.arrangementDetails.length === 0 ? (
              <p className="text-muted mt-2">
                Tempo, meter, key, and arrangement duration are unchanged.
              </p>
            ) : (
              <dl className="rounded-card border-subtle mt-4 grid gap-4 border p-5 sm:grid-cols-2">
                {model.arrangementDetails.map((detail) => (
                  <div key={detail.field}>
                    <dt className="font-semibold">{detail.label}</dt>
                    <dd className="mt-1 text-sm">
                      <span className="text-muted">{sideLabels.before}:</span>{" "}
                      {detail.before}
                      <br />
                      <span className="text-muted">
                        {sideLabels.after}:
                      </span>{" "}
                      {detail.after}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        </>
      )}

      <section className="mt-8" aria-labelledby="pattern-credit-heading">
        <h3 id="pattern-credit-heading" className="text-xl font-bold">
          Pattern attribution
        </h3>
        {model.credits.length === 0 ? (
          <p className="text-muted mt-2">
            Neither arrangement contains a MIDI pattern to credit.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {model.credits.map((pattern) => (
              <li
                className="rounded-control border-subtle border p-4"
                key={pattern.midiPatternVersionId}
              >
                <strong>{pattern.creatorCreditName}</strong>
                <span className="text-muted block text-sm">
                  Pattern version {pattern.version}
                </span>
                {pattern.reuseLicenseCode && (
                  <a
                    className="text-accent text-sm underline"
                    href={pattern.reuseLicenseUrl ?? undefined}
                  >
                    {pattern.reuseLicenseCode}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="border-subtle mt-8 border-t pt-5 text-sm">
        <summary className="cursor-pointer font-semibold">
          Technical comparison details
        </summary>
        <dl className="text-muted mt-3 space-y-2 break-all">
          <div>
            <dt className="font-semibold">Algorithm</dt>
            <dd>{model.algorithmVersion}</dd>
          </div>
          {technicalIds.map((item) => (
            <div key={item.label}>
              <dt className="font-semibold">{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
          {model.credits.length > 0 && (
            <div>
              <dt className="font-semibold">Pattern identifiers</dt>
              <dd>
                <ul className="mt-1 space-y-3">
                  {model.credits.map((pattern) => (
                    <li key={pattern.midiPatternVersionId}>
                      <span className="text-ink block">
                        {pattern.creatorCreditName} · pattern version{" "}
                        {pattern.version}
                      </span>
                      <span className="block">
                        Pattern version ID: {pattern.midiPatternVersionId}
                      </span>
                      <span className="block">
                        Pattern ID: {pattern.midiPatternId}
                      </span>
                      {pattern.parentMidiPatternVersionId && (
                        <span className="block">
                          Parent version ID:{" "}
                          {pattern.parentMidiPatternVersionId}
                        </span>
                      )}
                      {pattern.sourceMidiPatternVersionId && (
                        <span className="block">
                          Source version ID:{" "}
                          {pattern.sourceMidiPatternVersionId}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>
      </details>
    </section>
  );
}
