"use client";

import { MidiDiffComparisonSurface } from "@/features/midi-diff/comparison-surface.client";
import type { ContributionArrangementComparison } from "./types";

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

export function ReviewComparison(props: ReviewComparisonProps) {
  if (!props.comparison) {
    return <ComparisonState kind={props.unavailableReason ?? "unavailable"} />;
  }
  const comparison = props.comparison;
  return (
    <MidiDiffComparisonSurface
      before={comparison.base}
      after={comparison.submitted}
      semanticDiff={comparison.semanticDiff}
      sideLabels={{ before: "Base revision", after: "Submitted version" }}
      eyebrow="Base revision → submitted version"
      heading="Contribution comparison"
      description="Hear either exact immutable arrangement, then explore what changed in musician-friendly detail."
      unchangedTitle="No musical changes found"
      unchangedMessage="The submitted arrangement matches its exact base: no arrangement, track, clip, note, or lineage values changed."
      technicalIds={[
        {
          label: "Base arrangement version",
          value: comparison.baseArrangementVersionId,
        },
        {
          label: "Submitted arrangement version",
          value: comparison.submittedArrangementVersionId,
        },
      ]}
    />
  );
}
