"use client";

import { useState } from "react";
import {
  StudioLauncher,
  type StudioLauncherProps,
} from "@/features/studio/components/studio-launcher.client";
import type { ContributionArrangementComparison } from "./types";
import { summarizeContributionDiff } from "./semantic-summary";

export function ReviewComparison({
  comparison,
  base,
  submitted,
}: {
  comparison: ContributionArrangementComparison;
  base: StudioLauncherProps;
  submitted: StudioLauncherProps;
}) {
  const [selected, setSelected] = useState<"base" | "submitted">("submitted");
  const summary = summarizeContributionDiff(comparison.semanticDiff);
  return (
    <section className="mt-10">
      <h2 className="text-2xl font-bold">Audition and compare</h2>
      <p className="text-muted mt-2">
        Switch between the exact immutable base and submitted arrangements.
      </p>
      <div className="my-4 flex flex-wrap gap-3">
        <button
          aria-pressed={selected === "base"}
          className="rounded-control border-strong min-h-11 border px-5 font-semibold"
          onClick={() => setSelected("base")}
          type="button"
        >
          Base revision
        </button>
        <button
          aria-pressed={selected === "submitted"}
          className="rounded-control border-strong min-h-11 border px-5 font-semibold"
          onClick={() => setSelected("submitted")}
          type="button"
        >
          Submitted version
        </button>
      </div>
      <StudioLauncher
        key={selected}
        {...(selected === "base" ? base : submitted)}
      />
      <h2 className="mt-10 text-2xl font-bold">Semantic change summary</h2>
      <p className="text-muted mt-2">
        Compared against the exact immutable base arrangement using{" "}
        <code>{comparison.semanticDiff.algorithmVersion}</code>.
      </p>
      {comparison.semanticDiff.unchanged ? (
        <p className="rounded-control border-subtle mt-4 border p-4">
          The submitted arrangement is musically unchanged.
        </p>
      ) : (
        <dl className="rounded-card border-subtle mt-4 grid gap-4 border p-6 sm:grid-cols-2">
          {summary.map((item) => (
            <div key={item.label}>
              <dt className="text-muted">{item.label}</dt>
              <dd className="text-xl font-semibold">{item.count}</dd>
            </div>
          ))}
        </dl>
      )}
      <h3 className="mt-8 text-xl font-bold">Pattern attribution</h3>
      <ul className="mt-3 space-y-3">
        {comparison.patternAttributions.map((pattern) => (
          <li
            className="rounded-control border-subtle border p-4"
            key={pattern.midiPatternVersionId}
          >
            <strong>{pattern.creatorCreditName}</strong>
            <span className="text-muted block text-sm">
              Pattern version {pattern.midiPatternVersionId}
            </span>
            {pattern.sourceMidiPatternVersionId && (
              <span className="text-muted block text-sm">
                Source version {pattern.sourceMidiPatternVersionId}
              </span>
            )}
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
    </section>
  );
}
