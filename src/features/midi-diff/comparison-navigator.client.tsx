"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { MidiDiffNoteOverlay } from "./note-overlay.client";
import {
  MIDI_DIFF_VISUAL_STATES,
  type MidiDiffChangeState,
  type MidiDiffClip,
  type MidiDiffFieldDetail,
  type MidiDiffPatternCredit,
  type MidiDiffReadyViewModel,
  type MidiDiffTrack,
  type MidiDiffTrackSide,
  type MidiDiffClipSide,
} from "./types";

function stateClasses(state: MidiDiffChangeState) {
  if (state === "added") return "border-accent-2 text-accent-2 bg-surface-soft";
  if (state === "changed") return "border-accent text-accent bg-surface-soft";
  return "border-subtle text-muted bg-surface-soft border-dashed";
}

function StateLabel({ state }: { state: MidiDiffChangeState }) {
  const visual = MIDI_DIFF_VISUAL_STATES[state];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-mono text-xs font-bold ${stateClasses(state)}`}
    >
      <span aria-hidden="true">{visual.marker}</span>
      {visual.label}
    </span>
  );
}

function DetailsList({ details }: { details: MidiDiffFieldDetail[] }) {
  if (details.length === 0) return null;
  return (
    <dl className="mt-5 space-y-3">
      {details.map((detail) => (
        <div
          className="border-subtle grid gap-2 border-t pt-3 sm:grid-cols-[minmax(8rem,0.7fr)_1fr_1fr]"
          key={detail.field}
        >
          <dt className="font-semibold">{detail.label}</dt>
          <dd>
            <span className="text-muted block text-xs uppercase">Before</span>
            {detail.before}
          </dd>
          <dd>
            <span className="text-muted block text-xs uppercase">After</span>
            {detail.after}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function TrackSideDetails({
  label,
  side,
}: {
  label: string;
  side: MidiDiffTrackSide | null;
}) {
  return (
    <div className="rounded-control border-subtle bg-surface-soft border p-4">
      <h4 className="text-muted font-mono text-xs font-semibold tracking-[0.14em] uppercase">
        {label}
      </h4>
      {side ? (
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="text-muted">Track</dt>
            <dd>{side.name}</dd>
          </div>
          <div>
            <dt className="text-muted">Order</dt>
            <dd>{side.orderLabel}</dd>
          </div>
          <div>
            <dt className="text-muted">Instrument</dt>
            <dd>
              {side.presetName}{" "}
              <span className="text-muted">({side.presetTechnicalName})</span>
            </dd>
          </div>
          <div>
            <dt className="text-muted">Mixer</dt>
            <dd>
              {side.gainLabel} · {side.panLabel} · {side.mutedLabel} ·{" "}
              {side.soloedLabel}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-muted mt-3">Not present on this side.</p>
      )}
    </div>
  );
}

function PatternCredit({ credit }: { credit: MidiDiffPatternCredit }) {
  return (
    <div className="mt-3 text-sm">
      <p className="font-semibold">
        Pattern v{credit.version} by {credit.creatorCreditName}
      </p>
      {credit.reuseLicenseCode && (
        <a
          className="text-accent underline"
          href={credit.reuseLicenseUrl ?? undefined}
        >
          {credit.reuseLicenseCode}
        </a>
      )}
    </div>
  );
}

function ClipSideDetails({
  label,
  side,
}: {
  label: string;
  side: MidiDiffClipSide | null;
}) {
  return (
    <div className="rounded-control border-subtle bg-surface-soft border p-4">
      <h4 className="text-muted font-mono text-xs font-semibold tracking-[0.14em] uppercase">
        {label}
      </h4>
      {side ? (
        <>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-muted">Track</dt>
              <dd>{side.trackName}</dd>
            </div>
            <div>
              <dt className="text-muted">Placement</dt>
              <dd>
                {side.positionLabel} · {side.durationLabel}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Pattern window</dt>
              <dd>
                Starts {side.sourcePositionLabel} · {side.loopLabel}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Pattern notes</dt>
              <dd>{side.noteCount}</dd>
            </div>
          </dl>
          <PatternCredit credit={side.pattern} />
        </>
      ) : (
        <p className="text-muted mt-3">Not present on this side.</p>
      )}
    </div>
  );
}

function SelectedTrack({
  track,
  model,
}: {
  track: MidiDiffTrack;
  model: MidiDiffReadyViewModel;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <StateLabel state={track.state} />
        <h3 className="text-2xl font-bold">{track.label}</h3>
      </div>
      <p className="text-muted mt-2">{track.contextLabel}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <TrackSideDetails label={model.sideLabels.before} side={track.before} />
        <TrackSideDetails label={model.sideLabels.after} side={track.after} />
      </div>
      {track.details.length > 0 ? (
        <DetailsList details={track.details} />
      ) : (
        <p className="text-muted mt-5">
          The track settings are unchanged; select one of its clips for the
          musical changes.
        </p>
      )}
    </>
  );
}

function SelectedClip({
  clip,
  model,
}: {
  clip: MidiDiffClip;
  model: MidiDiffReadyViewModel;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <StateLabel state={clip.state} />
        <h3 className="text-2xl font-bold">{clip.label}</h3>
      </div>
      <p className="text-muted mt-2">{clip.contextLabel}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <ClipSideDetails label={model.sideLabels.before} side={clip.before} />
        <ClipSideDetails label={model.sideLabels.after} side={clip.after} />
      </div>
      <DetailsList details={clip.details} />
      <MidiDiffNoteOverlay clip={clip} sideLabels={model.sideLabels} />
      {clip.lineageDetails.length > 0 && (
        <section className="mt-6" aria-labelledby="selected-lineage-heading">
          <h4 id="selected-lineage-heading" className="text-lg font-bold">
            Pattern lineage changes
          </h4>
          <DetailsList details={clip.lineageDetails} />
        </section>
      )}
    </>
  );
}

function filteredTracks(
  tracks: MidiDiffTrack[],
  filter: MidiDiffChangeState | null,
) {
  if (!filter) return tracks;
  return tracks
    .map((track) => ({
      ...track,
      clips: track.clips.filter((clip) => clip.states.includes(filter)),
    }))
    .filter((track) => track.states.includes(filter) || track.clips.length > 0);
}

function selectionIds(tracks: MidiDiffTrack[]) {
  return tracks.flatMap((track) => [
    track.selectionId,
    ...track.clips.map((clip) => clip.selectionId),
  ]);
}

export function MidiDiffComparisonNavigator({
  model,
  onSelectionChange,
}: {
  model: MidiDiffReadyViewModel;
  onSelectionChange?: (selectionId: string | null) => void;
}) {
  const [filter, setFilter] = useState<MidiDiffChangeState | null>(null);
  const [selectedId, setSelectedId] = useState(model.defaultSelectionId);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const visibleTracks = filteredTracks(model.tracks, filter);
  const visibleIds = selectionIds(visibleTracks);
  const selectedTrack = model.tracks.find(
    (track) => track.selectionId === selectedId,
  );
  const selectedClip = model.tracks
    .flatMap((track) => track.clips)
    .find((clip) => clip.selectionId === selectedId);

  function applyFilter(state: MidiDiffChangeState) {
    const nextFilter = filter === state ? null : state;
    const nextIds = selectionIds(filteredTracks(model.tracks, nextFilter));
    setFilter(nextFilter);
    if (nextIds.length === 0) {
      setSelectedId(null);
      onSelectionChange?.(null);
    } else if (!selectedId || !nextIds.includes(selectedId)) {
      setSelectedId(nextIds[0]);
      onSelectionChange?.(nextIds[0]);
    }
  }

  function moveSelection(
    event: KeyboardEvent<HTMLButtonElement>,
    selectionId: string,
  ) {
    const currentIndex = visibleIds.indexOf(selectionId);
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight")
      nextIndex = (currentIndex + 1) % visibleIds.length;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft")
      nextIndex = (currentIndex - 1 + visibleIds.length) % visibleIds.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = visibleIds.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextId = visibleIds[nextIndex];
    setSelectedId(nextId);
    onSelectionChange?.(nextId);
    buttonRefs.current.get(nextId)?.focus();
  }

  return (
    <div className="mt-5">
      <div aria-label="Filter comparison navigator by change type" role="group">
        <p className="text-muted text-sm">
          Counts include each changed arrangement field, track, clip, unique
          note, and lineage relationship once. Choose a card to filter the
          navigator.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(Object.keys(MIDI_DIFF_VISUAL_STATES) as MidiDiffChangeState[]).map(
            (state) => {
              const visual = MIDI_DIFF_VISUAL_STATES[state];
              const count = model.counts[state];
              return (
                <button
                  aria-pressed={filter === state}
                  className={`rounded-card min-h-24 border p-4 text-left transition-colors ${stateClasses(state)} ${filter === state ? "ring-2 ring-current ring-offset-2 ring-offset-[var(--color-canvas)]" : ""}`}
                  key={state}
                  onClick={() => applyFilter(state)}
                  type="button"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-sm font-bold">
                      <span aria-hidden="true">{visual.marker}</span>{" "}
                      {visual.label}
                    </span>
                    <strong className="text-3xl">{count.total}</strong>
                  </span>
                  <span className="mt-2 block text-xs">
                    {count.tracks} tracks · {count.clips} clips · {count.notes}{" "}
                    unique notes
                  </span>
                </button>
              );
            },
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(15rem,0.75fr)_minmax(0,1.5fr)]">
        <nav
          aria-label="Changed tracks and clips"
          className="rounded-card border-subtle bg-surface border p-4"
        >
          <h3 className="font-bold">Tracks and clips</h3>
          <p className="text-muted mt-1 text-sm">
            Use the arrow keys to move through the comparison.
          </p>
          {visibleTracks.length === 0 ? (
            <p className="rounded-control border-subtle text-muted mt-4 border border-dashed p-4">
              No{" "}
              {filter
                ? MIDI_DIFF_VISUAL_STATES[filter].label.toLowerCase()
                : "changed"}{" "}
              tracks or clips are available in this view.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {visibleTracks.map((track) => (
                <li key={track.trackId}>
                  <button
                    aria-current={selectedId === track.selectionId}
                    className={`rounded-control border-subtle hover:border-accent focus:border-accent w-full border p-3 text-left ${selectedId === track.selectionId ? "bg-surface-raised border-accent" : ""}`}
                    onClick={() => {
                      setSelectedId(track.selectionId);
                      onSelectionChange?.(track.selectionId);
                    }}
                    onKeyDown={(event) =>
                      moveSelection(event, track.selectionId)
                    }
                    ref={(node) => {
                      if (node) buttonRefs.current.set(track.selectionId, node);
                      else buttonRefs.current.delete(track.selectionId);
                    }}
                    tabIndex={selectedId === track.selectionId ? 0 : -1}
                    type="button"
                  >
                    <span className="flex items-center gap-2">
                      <StateLabel state={track.state} />
                      <strong>{track.label}</strong>
                    </span>
                    <span className="text-muted mt-1 block text-sm">
                      {track.contextLabel}
                    </span>
                  </button>
                  {track.clips.length > 0 && (
                    <ul className="border-subtle mt-2 ml-4 space-y-2 border-l pl-3">
                      {track.clips.map((clip) => (
                        <li key={clip.clipId}>
                          <button
                            aria-current={selectedId === clip.selectionId}
                            className={`rounded-control border-subtle hover:border-accent focus:border-accent w-full border p-3 text-left ${selectedId === clip.selectionId ? "bg-surface-raised border-accent" : ""}`}
                            onClick={() => {
                              setSelectedId(clip.selectionId);
                              onSelectionChange?.(clip.selectionId);
                            }}
                            onKeyDown={(event) =>
                              moveSelection(event, clip.selectionId)
                            }
                            ref={(node) => {
                              if (node)
                                buttonRefs.current.set(clip.selectionId, node);
                              else buttonRefs.current.delete(clip.selectionId);
                            }}
                            tabIndex={selectedId === clip.selectionId ? 0 : -1}
                            type="button"
                          >
                            <span className="flex items-center gap-2">
                              <StateLabel state={clip.state} />
                              <strong>{clip.label}</strong>
                            </span>
                            <span className="text-muted mt-1 block text-sm">
                              {clip.contextLabel}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </nav>

        <section className="rounded-card border-subtle bg-surface min-w-0 border p-5 sm:p-6">
          <p className="sr-only" role="status">
            {selectedClip
              ? `Selected ${selectedClip.label}`
              : selectedTrack
                ? `Selected ${selectedTrack.label}`
                : "No track or clip selected"}
          </p>
          {selectedClip ? (
            <SelectedClip clip={selectedClip} model={model} />
          ) : selectedTrack ? (
            <SelectedTrack model={model} track={selectedTrack} />
          ) : (
            <p className="text-muted">
              Choose a changed track or clip to inspect both immutable sides.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
