"use client";

import { useRouter } from "next/navigation";
import type { ArrangementManifestV3 } from "@/features/studio/manifest/v3";
import type { MidiPatternVersionV3 } from "@/features/midi/domain-v3";
import {
  MIDI_V3_ENGINE_ID,
  MIDI_V3_ENGINE_VERSION,
} from "@/features/midi/domain-v3";
import { MidiDiffNoteOverlay } from "@/features/midi-diff/note-overlay.client";
import { MidiDiffPairedAudition } from "@/features/midi-diff/paired-audition.client";
import { createPatternVersionDiffClip } from "@/features/midi-diff/pattern-version-diff";
import type {
  MidiLibraryHistoryVersion,
  MidiLibraryPatternComparison,
} from "./types";

const TRACK_ID = "00000000-0000-4000-8000-000000000101";
const CLIP_ID = "00000000-0000-4000-8000-000000000102";

function auditionSide(
  version: MidiLibraryHistoryVersion,
  preset: { id: string; version: number },
  title: string,
) {
  const pattern: MidiPatternVersionV3 = {
    midiPatternVersionId: version.midiPatternVersionId,
    midiPatternId: version.midiPatternId,
    version: version.versionNumber,
    creatorId: version.creatorId,
    creatorCreditName: version.creatorCreditName,
    parentMidiPatternVersionId: version.parentMidiPatternVersionId,
    sourceMidiPatternVersionId: version.sourceMidiPatternVersionId,
    ppq: 480,
    durationTicks: version.durationTicks,
    noteCount: version.noteCount,
    contentSha256: version.contentSha256,
    reuseLicense:
      version.reuseLicenseCode === "CC-BY-4.0"
        ? {
            code: "CC-BY-4.0",
            version: "4.0",
            url: "https://creativecommons.org/licenses/by/4.0/",
          }
        : null,
    createdAt: version.createdAt,
    notes: version.notes,
  };
  const manifest: ArrangementManifestV3 = {
    manifestVersion: 3,
    engine: MIDI_V3_ENGINE_ID,
    engineVersion: MIDI_V3_ENGINE_VERSION,
    projectId: version.midiPatternId,
    tempoBpm: 120,
    timeSignature: { numerator: 4, denominator: 4 },
    musicalKey: "c-major",
    ppq: 480,
    durationTicks: version.durationTicks,
    tracks: [
      {
        trackId: TRACK_ID,
        sortOrder: 0,
        name: title,
        presetId: preset.id,
        presetVersion: preset.version,
        gainDb: -6,
        pan: 0,
        muted: false,
        soloed: false,
        clips: [
          {
            clipId: CLIP_ID,
            midiPatternVersionId: version.midiPatternVersionId,
            startTick: 0,
            durationTicks: version.durationTicks,
            sourceStartTick: 0,
            loop: false,
          },
        ],
      },
    ],
  };
  return { manifest, patternVersions: [pattern] };
}

export function MidiLibraryPatternComparisonView({
  listingId,
  title,
  preset,
  history,
  comparison,
}: {
  listingId: string;
  title: string;
  preset: { id: string; version: number };
  history: MidiLibraryHistoryVersion[];
  comparison: MidiLibraryPatternComparison;
}) {
  const router = useRouter();
  const selectorVersions = [...history, comparison.from, comparison.to]
    .filter(
      (version, index, versions) =>
        versions.findIndex(
          (candidate) =>
            candidate.midiPatternVersionId === version.midiPatternVersionId,
        ) === index,
    )
    .sort((left, right) => left.versionNumber - right.versionNumber);
  const pair = {
    from: comparison.from.midiPatternVersionId,
    to: comparison.to.midiPatternVersionId,
  };
  const navigate = (next: typeof pair) =>
    router.push(
      `/library/${listingId}?from=${next.from}&to=${next.to}#compare`,
    );
  const sideLabels = {
    before: `Version ${comparison.from.versionNumber}`,
    after: `Version ${comparison.to.versionNumber}`,
  };
  const clip = createPatternVersionDiffClip({
    before: comparison.from,
    after: comparison.to,
    title,
  });
  return (
    <section
      id="compare"
      className="mt-12 scroll-mt-28"
      aria-labelledby="history-comparison-heading"
    >
      <p className="text-accent-2 font-mono text-xs uppercase">
        Immutable pattern history
      </p>
      <h2 id="history-comparison-heading" className="mt-2 text-3xl font-bold">
        Compare exact versions
      </h2>
      <p className="text-muted mt-2">
        Only versions proven readable in this pattern history appear here. The
        exact pair stays in the URL.
      </p>
      <div className="rounded-card border-subtle bg-surface mt-5 grid gap-4 border p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        {(["from", "to"] as const).map((side) => (
          <label key={side} className="font-semibold">
            {side === "from" ? "From version" : "To version"}
            <select
              value={pair[side]}
              onChange={(event) =>
                navigate({ ...pair, [side]: event.target.value })
              }
              className="border-strong bg-canvas mt-2 block min-h-11 w-full rounded-full border px-4"
            >
              {selectorVersions.map((version) => (
                <option
                  key={version.midiPatternVersionId}
                  value={version.midiPatternVersionId}
                >
                  Version {version.versionNumber} · {version.creatorCreditName}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button
          type="button"
          onClick={() => navigate({ from: pair.to, to: pair.from })}
          className="border-strong hover:border-accent min-h-11 rounded-full border px-5 font-semibold"
        >
          Swap sides
        </button>
      </div>
      <MidiDiffPairedAudition
        before={auditionSide(comparison.from, preset, title)}
        after={auditionSide(comparison.to, preset, title)}
        sideLabels={sideLabels}
        selectionKey={`${pair.from}:${pair.to}`}
      />
      <MidiDiffNoteOverlay clip={clip} sideLabels={sideLabels} />
      {clip.noteChanges.length === 0 && (
        <p
          className="text-muted rounded-card border-subtle mt-4 border border-dashed p-5"
          role="status"
        >
          These exact versions have no note changes.
        </p>
      )}
    </section>
  );
}
