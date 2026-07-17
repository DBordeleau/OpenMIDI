"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { MidiDiffComparisonNavigator } from "@/features/midi-diff/comparison-navigator.client";
import { createMidiDiffViewModel } from "@/features/midi-diff/view-model";
import type { ContributionArrangementComparison } from "./types";

const MidiDiffPairedAudition = dynamic(
  () =>
    import("@/features/midi-diff/paired-audition.client").then(
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

type ReviewComparisonProps =
  | {
      comparison: ContributionArrangementComparison;
      unavailableReason?: never;
    }
  | {
      comparison: null;
      unavailableReason?: "unavailable" | "inconsistent";
    };

function ComparisonState({ kind }: { kind: "unavailable" | "inconsistent" }) {
  const inconsistent = kind === "inconsistent";
  return (
    <section className="mt-10" aria-labelledby="comparison-heading">
      <h2 id="comparison-heading" className="text-2xl font-bold">
        Contribution comparison
      </h2>
      <div className="rounded-card border-subtle mt-4 border border-dashed p-6">
        <h3 className="text-lg font-bold">
          {inconsistent
            ? "Comparison needs attention"
            : "Comparison unavailable"}
        </h3>
        <p className="text-muted mt-2">
          {inconsistent
            ? "The immutable comparison data is inconsistent, so OpenMIDI will not guess at what changed. Reload the review; if this continues, report the contribution for investigation."
            : "One of the exact immutable arrangements is unavailable. Reload the review or choose another submitted version."}
        </p>
      </div>
    </section>
  );
}

function AvailableReviewComparison({
  comparison,
}: Extract<ReviewComparisonProps, { comparison: object }>) {
  const model = useMemo(
    () =>
      createMidiDiffViewModel({
        semanticDiff: comparison.semanticDiff,
        before: comparison.base,
        after: comparison.submitted,
        sideLabels: {
          before: "Base revision",
          after: "Submitted version",
        },
      }),
    [comparison],
  );
  const [selectedObject, setSelectedObject] = useState<string | null>(null);

  if (model.status === "unavailable" || model.status === "inconsistent") {
    return <ComparisonState kind={model.status} />;
  }

  return (
    <section className="mt-10" aria-labelledby="comparison-heading">
      <h2 id="comparison-heading" className="text-2xl font-bold">
        Contribution comparison
      </h2>
      <p className="text-muted mt-2">
        Hear either exact immutable arrangement, then explore what changed in
        musician-friendly detail.
      </p>

      <MidiDiffPairedAudition
        after={comparison.submitted}
        before={comparison.base}
        selectionKey={
          selectedObject ??
          (model.status === "ready"
            ? (model.defaultSelectionId ?? "arrangement")
            : "unchanged")
        }
        sideLabels={{ before: "Base revision", after: "Submitted version" }}
      />

      {model.status === "unchanged" ? (
        <div
          className="rounded-card border-subtle mt-6 border border-dashed p-6"
          role="status"
        >
          <h3 className="text-xl font-bold">No musical changes found</h3>
          <p className="text-muted mt-2">
            The submitted arrangement matches its exact base: no arrangement,
            track, clip, note, or lineage values changed.
          </p>
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
            <p className="text-accent-2 font-mono text-xs font-semibold tracking-[0.18em] uppercase">
              Base revision → submitted version
            </p>
            <h3 id="change-summary-heading" className="mt-2 text-2xl font-bold">
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
                      <span className="text-muted">Base:</span> {detail.before}
                      <br />
                      <span className="text-muted">Submitted:</span>{" "}
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
          <div>
            <dt className="font-semibold">Base arrangement version</dt>
            <dd>{comparison.baseArrangementVersionId}</dd>
          </div>
          <div>
            <dt className="font-semibold">Submitted arrangement version</dt>
            <dd>{comparison.submittedArrangementVersionId}</dd>
          </div>
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

export function ReviewComparison(props: ReviewComparisonProps) {
  if (!props.comparison) {
    return <ComparisonState kind={props.unavailableReason ?? "unavailable"} />;
  }
  return <AvailableReviewComparison {...props} />;
}
