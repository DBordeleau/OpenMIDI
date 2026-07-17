"use client";

import { useRouter } from "next/navigation";
import type { ProjectRevisionComparison } from "./project-revision-types";
import { MidiDiffComparisonSurface } from "./comparison-surface.client";
import { projectRevisionComparisonUrl } from "./project-revision-url";

export function ProjectRevisionComparisonView({
  comparison,
}: {
  comparison: ProjectRevisionComparison;
}) {
  const router = useRouter();
  const pair = {
    from: comparison.before.revisionId,
    to: comparison.after.revisionId,
  };

  function navigate(next: { from: string; to: string }) {
    router.push(
      projectRevisionComparisonUrl({
        projectId: comparison.project.id,
        ...next,
      }),
    );
  }

  const sameRevision = pair.from === pair.to;
  const sideLabels = {
    before: `Revision ${comparison.before.revisionNumber}`,
    after: `Revision ${comparison.after.revisionNumber}`,
  };

  return (
    <>
      <section
        className="rounded-card border-subtle bg-surface mt-8 border p-5 sm:p-6"
        aria-labelledby="revision-pair-heading"
      >
        <h2 id="revision-pair-heading" className="text-xl font-bold">
          Choose two revisions
        </h2>
        <p className="text-muted mt-2 text-sm">
          Compare any two readable revisions in this project. The URL keeps the
          exact pair for reloads and sharing.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="font-semibold">
            From revision
            <select
              className="border-strong bg-canvas mt-2 block min-h-11 w-full rounded-full border px-4"
              value={pair.from}
              onChange={(event) =>
                navigate({ from: event.target.value, to: pair.to })
              }
            >
              {comparison.revisions.map((revision) => (
                <option key={revision.id} value={revision.id}>
                  Revision {revision.revisionNumber}
                  {revision.message ? ` — ${revision.message}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="font-semibold">
            To revision
            <select
              className="border-strong bg-canvas mt-2 block min-h-11 w-full rounded-full border px-4"
              value={pair.to}
              onChange={(event) =>
                navigate({ from: pair.from, to: event.target.value })
              }
            >
              {comparison.revisions.map((revision) => (
                <option key={revision.id} value={revision.id}>
                  Revision {revision.revisionNumber}
                  {revision.message ? ` — ${revision.message}` : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            className="border-strong hover:border-accent focus:border-accent min-h-11 rounded-full border px-5 font-semibold"
            onClick={() => navigate({ from: pair.to, to: pair.from })}
            type="button"
          >
            Swap sides
          </button>
        </div>
      </section>

      {comparison.onlyRevision ? (
        <section
          className="rounded-card border-subtle mt-8 border border-dashed p-6"
          role="status"
        >
          <h2 className="text-xl font-bold">One revision so far</h2>
          <p className="text-muted mt-2">
            This project has no earlier immutable revision to compare. Revision{" "}
            {comparison.after.revisionNumber} is shown on both sides without an
            invented parent or change.
          </p>
        </section>
      ) : null}

      <MidiDiffComparisonSurface
        before={{
          manifest: comparison.before.manifest,
          patternVersions: comparison.before.patternVersions,
        }}
        after={{
          manifest: comparison.after.manifest,
          patternVersions: comparison.after.patternVersions,
        }}
        semanticDiff={comparison.semanticDiff}
        sideLabels={sideLabels}
        eyebrow={`${sideLabels.before} → ${sideLabels.after}`}
        heading="Hear the arrangement evolve"
        description="Audition either exact immutable side, then follow every arrangement, track, clip, note, and lineage change."
        unchangedTitle={
          sameRevision
            ? "Same revision on both sides"
            : "No musical changes found"
        }
        unchangedMessage={
          sameRevision
            ? `Revision ${comparison.before.revisionNumber} is selected twice, so Added and Removed are both zero. Choose another revision to compare its musical changes.`
            : "These two immutable revisions have the same arrangement, track, clip, note, and lineage values."
        }
        technicalIds={[
          {
            label: `${sideLabels.before} arrangement version`,
            value: comparison.before.arrangementVersionId,
          },
          {
            label: `${sideLabels.after} arrangement version`,
            value: comparison.after.arrangementVersionId,
          },
        ]}
      />
    </>
  );
}
