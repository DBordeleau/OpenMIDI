"use client";

import { useState } from "react";
import { MIDI_V3_PPQ } from "@/features/midi/domain-v3";
import { midiPitchName } from "@/features/midi/stems/piano-roll";
import {
  MIDI_DIFF_VISUAL_STATES,
  type MidiDiffChangeState,
  type MidiDiffClip,
} from "./types";
import {
  createMidiDiffNoteOverlay,
  midiDiffNoteText,
  type MidiDiffOverlayRect,
} from "./note-overlay";

const VIEWBOX_WIDTH = 1_000;
const VIEWBOX_HEIGHT = 360;
const LABEL_GUTTER = 76;
const ROLL_WIDTH = VIEWBOX_WIDTH - LABEL_GUTTER;

function rectAttributes(rect: MidiDiffOverlayRect) {
  return {
    x: LABEL_GUTTER + rect.x * ROLL_WIDTH,
    y: rect.y * VIEWBOX_HEIGHT + 1,
    width: Math.max(2, rect.width * ROLL_WIDTH),
    height: Math.max(2, rect.height * VIEWBOX_HEIGHT - 2),
  };
}

function NoteRect({
  rect,
  state,
  side,
  marker,
}: {
  rect: MidiDiffOverlayRect;
  state: MidiDiffChangeState;
  side: "before" | "after";
  marker: string;
}) {
  const attributes = rectAttributes(rect);
  const changedBefore = state === "changed" && side === "before";
  const fill =
    state === "added"
      ? "var(--color-accent-2)"
      : state === "changed" && side === "after"
        ? "var(--color-accent)"
        : "transparent";
  const stroke =
    state === "added"
      ? "var(--color-accent-2)"
      : state === "changed"
        ? "var(--color-accent)"
        : "var(--color-text-muted)";
  return (
    <g
      data-note-side={side}
      data-note-state={state}
      opacity={changedBefore ? 0.62 : 1}
    >
      <rect
        {...attributes}
        fill={fill}
        rx={3}
        stroke={stroke}
        strokeDasharray={state === "removed" ? "8 5" : undefined}
        strokeWidth={changedBefore || state === "removed" ? 2 : 1}
      />
      {attributes.width >= 18 && !changedBefore && (
        <text
          fill={
            state === "removed"
              ? "var(--color-text-muted)"
              : "var(--color-accent-contrast)"
          }
          fontFamily="monospace"
          fontSize="12"
          fontWeight="700"
          x={attributes.x + 5}
          y={attributes.y + Math.min(attributes.height - 3, 14)}
        >
          {marker}
        </text>
      )}
    </g>
  );
}

function Legend() {
  return (
    <ul
      aria-label="Note comparison legend"
      className="mt-4 flex flex-wrap gap-3 text-sm"
    >
      {(Object.keys(MIDI_DIFF_VISUAL_STATES) as MidiDiffChangeState[]).map(
        (state) => {
          const visual = MIDI_DIFF_VISUAL_STATES[state];
          return (
            <li className="flex items-center gap-2" key={state}>
              <span
                aria-hidden="true"
                className={`inline-flex h-5 w-9 items-center justify-center rounded-sm border font-mono text-xs font-bold ${
                  state === "added"
                    ? "border-accent-2 bg-accent-2 text-accent-contrast"
                    : state === "changed"
                      ? "border-accent bg-accent text-accent-contrast"
                      : "border-subtle text-muted border-dashed bg-transparent"
                }`}
              >
                {visual.marker}
              </span>
              <span>{visual.label}</span>
              {state === "removed" && (
                <span className="text-muted">dashed outline</span>
              )}
              {state === "changed" && (
                <span className="text-muted">before outline + after fill</span>
              )}
            </li>
          );
        },
      )}
      <li className="text-muted flex items-center gap-2">
        <span
          aria-hidden="true"
          className="border-strong bg-surface-raised h-3 w-9 rounded-sm border opacity-50"
        />
        Unchanged context
      </li>
    </ul>
  );
}

export function MidiDiffNoteOverlay({
  clip,
  sideLabels,
}: {
  clip: MidiDiffClip;
  sideLabels: { before: string; after: string };
}) {
  const [filter, setFilter] = useState<MidiDiffChangeState | null>(null);
  const model = createMidiDiffNoteOverlay(clip);
  const visibleChanges = filter
    ? model.changes.filter((note) => note.state === filter)
    : model.changes;
  const trackLabel = clip.after?.trackName ?? clip.before?.trackName ?? "Track";
  const clipLabel =
    clip.after?.positionLabel ?? clip.before?.positionLabel ?? clip.label;
  const pitchRows = Array.from(
    { length: model.viewport.maxPitch - model.viewport.minPitch + 1 },
    (_, index) => model.viewport.maxPitch - index,
  );
  const firstBeat =
    Math.ceil(model.viewport.startTick / MIDI_V3_PPQ) * MIDI_V3_PPQ;
  const beatTicks: number[] = [];
  for (
    let tick = firstBeat;
    tick < model.viewport.endTick;
    tick += MIDI_V3_PPQ
  ) {
    beatTicks.push(tick);
  }

  return (
    <section
      className="border-subtle bg-surface-soft rounded-card mt-6 border p-4 sm:p-5"
      aria-labelledby="note-overlay-heading"
    >
      <p className="text-accent-2 font-mono text-xs font-semibold tracking-[0.14em] uppercase">
        Selected track · {trackLabel}
      </p>
      <h4 id="note-overlay-heading" className="mt-2 text-xl font-bold">
        Note comparison · {clipLabel}
      </h4>
      <p className="text-muted mt-2 text-sm">
        Static combined overlay · ticks {model.viewport.startTick}–
        {model.viewport.endTick} · pitches{" "}
        {midiPitchName(model.viewport.minPitch)}–
        {midiPitchName(model.viewport.maxPitch)}
      </p>

      <div
        className="mt-4"
        role="group"
        aria-label="Filter selected clip note changes"
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(MIDI_DIFF_VISUAL_STATES) as MidiDiffChangeState[]).map(
            (state) => {
              const visual = MIDI_DIFF_VISUAL_STATES[state];
              return (
                <button
                  aria-pressed={filter === state}
                  className={`min-h-11 rounded-full border px-4 text-left font-semibold transition-colors ${
                    state === "added"
                      ? "border-accent-2 text-accent-2"
                      : state === "changed"
                        ? "border-accent text-accent"
                        : "border-subtle text-muted border-dashed"
                  }`}
                  key={state}
                  onClick={() => setFilter(filter === state ? null : state)}
                  type="button"
                >
                  <span className="font-mono">{visual.marker}</span>{" "}
                  {model.counts[state]} {visual.label}
                </button>
              );
            },
          )}
        </div>
      </div>
      <Legend />

      <div
        className="border-subtle rounded-control mt-4 overflow-x-auto border"
        role="region"
        aria-label="Read-only piano roll; scroll horizontally"
      >
        <svg
          aria-hidden="true"
          className="bg-canvas block min-w-[42rem]"
          preserveAspectRatio="none"
          role="img"
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        >
          <rect
            width={VIEWBOX_WIDTH}
            height={VIEWBOX_HEIGHT}
            fill="var(--color-canvas)"
          />
          {pitchRows.map((pitch, index) => {
            const y = (index / pitchRows.length) * VIEWBOX_HEIGHT;
            const height = VIEWBOX_HEIGHT / pitchRows.length;
            return (
              <g key={pitch}>
                <rect
                  x={LABEL_GUTTER}
                  y={y}
                  width={ROLL_WIDTH}
                  height={height}
                  fill={
                    pitch % 12 === 1 ||
                    pitch % 12 === 3 ||
                    pitch % 12 === 6 ||
                    pitch % 12 === 8 ||
                    pitch % 12 === 10
                      ? "var(--color-surface-soft)"
                      : "transparent"
                  }
                />
                <line
                  x1={0}
                  x2={VIEWBOX_WIDTH}
                  y1={y}
                  y2={y}
                  stroke="var(--color-border)"
                />
                {(pitch % 12 === 0 ||
                  index === 0 ||
                  index === pitchRows.length - 1) && (
                  <text
                    fill="var(--color-text-muted)"
                    fontFamily="monospace"
                    fontSize="11"
                    x={8}
                    y={y + Math.min(height - 2, 14)}
                  >
                    {midiPitchName(pitch)}
                  </text>
                )}
              </g>
            );
          })}
          <line
            x1={LABEL_GUTTER}
            x2={LABEL_GUTTER}
            y1={0}
            y2={VIEWBOX_HEIGHT}
            stroke="var(--color-border-strong)"
          />
          {beatTicks.map((tick) => {
            const x =
              LABEL_GUTTER +
              ((tick - model.viewport.startTick) /
                (model.viewport.endTick - model.viewport.startTick)) *
                ROLL_WIDTH;
            return (
              <line
                key={tick}
                x1={x}
                x2={x}
                y1={0}
                y2={VIEWBOX_HEIGHT}
                stroke="var(--color-border-strong)"
                strokeDasharray="2 5"
              />
            );
          })}
          {model.context.map((note) => (
            <rect
              {...rectAttributes(note.rect)}
              fill="var(--color-surface-raised)"
              key={note.noteId}
              opacity={0.55}
              rx={3}
              stroke="var(--color-border-strong)"
            />
          ))}
          {visibleChanges.map((note) => (
            <g key={note.noteId}>
              {note.beforeRect && note.overlay.beforeVisible && (
                <NoteRect
                  rect={note.beforeRect}
                  state={note.state}
                  side="before"
                  marker={note.marker}
                />
              )}
              {note.afterRect && note.overlay.afterVisible && (
                <NoteRect
                  rect={note.afterRect}
                  state={note.state}
                  side="after"
                  marker={note.marker}
                />
              )}
            </g>
          ))}
        </svg>
      </div>

      <section className="mt-5" aria-labelledby="note-text-heading">
        <h5 id="note-text-heading" className="font-bold">
          Note changes in text
        </h5>
        {visibleChanges.length === 0 ? (
          <p className="text-muted mt-2 text-sm">
            No{" "}
            {filter
              ? MIDI_DIFF_VISUAL_STATES[filter].label.toLowerCase()
              : "individual"}{" "}
            note changes in this clip.
          </p>
        ) : (
          <ol className="mt-3 space-y-2 text-sm">
            {visibleChanges.map((note) => (
              <li
                className="border-subtle rounded-control border p-3"
                key={note.noteId}
              >
                {midiDiffNoteText(note, sideLabels)}
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}
