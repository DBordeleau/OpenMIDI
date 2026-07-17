import { midiPitchName } from "@/features/midi/stems/piano-roll";
import type { MidiLibraryNote } from "./types";

const WIDTH = 1_000;
const HEIGHT = 320;
const GUTTER = 72;

export function MidiLibraryReadOnlyPianoRoll({
  notes,
  durationTicks,
}: {
  notes: MidiLibraryNote[];
  durationTicks: number;
}) {
  const minPitch = notes.length
    ? Math.max(0, Math.min(...notes.map((note) => note.pitch)) - 2)
    : 58;
  const maxPitch = notes.length
    ? Math.min(127, Math.max(...notes.map((note) => note.pitch)) + 2)
    : 62;
  const rows = maxPitch - minPitch + 1;
  return (
    <section className="mt-10" aria-labelledby="piano-roll-heading">
      <h2 id="piano-roll-heading" className="text-2xl font-bold">
        Read-only notes
      </h2>
      <p className="text-muted mt-2 text-sm">
        Exact immutable pattern version · PPQ 480 · {notes.length} notes
      </p>
      <div
        className="border-subtle bg-canvas rounded-card mt-4 overflow-x-auto border"
        role="region"
        aria-label="Read-only piano roll; scroll horizontally"
      >
        <svg
          aria-hidden="true"
          className="block min-w-[42rem]"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
        >
          <rect width={WIDTH} height={HEIGHT} fill="var(--color-canvas)" />
          {Array.from({ length: rows }, (_, index) => maxPitch - index).map(
            (pitch, index) => {
              const y = (index / rows) * HEIGHT;
              return (
                <g key={pitch}>
                  <rect
                    x={GUTTER}
                    y={y}
                    width={WIDTH - GUTTER}
                    height={HEIGHT / rows}
                    fill={
                      [1, 3, 6, 8, 10].includes(pitch % 12)
                        ? "var(--color-surface-soft)"
                        : "transparent"
                    }
                  />
                  <line
                    x1={0}
                    x2={WIDTH}
                    y1={y}
                    y2={y}
                    stroke="var(--color-border)"
                  />
                  {(pitch % 12 === 0 || index === 0 || index === rows - 1) && (
                    <text
                      x={8}
                      y={y + Math.min(14, HEIGHT / rows - 2)}
                      fill="var(--color-text-muted)"
                      fontFamily="monospace"
                      fontSize="11"
                    >
                      {midiPitchName(pitch)}
                    </text>
                  )}
                </g>
              );
            },
          )}
          {Array.from(
            { length: Math.ceil(durationTicks / 480) },
            (_, index) => index * 480,
          ).map((tick) => {
            const x = GUTTER + (tick / durationTicks) * (WIDTH - GUTTER);
            return (
              <line
                key={tick}
                x1={x}
                x2={x}
                y1={0}
                y2={HEIGHT}
                stroke="var(--color-border-strong)"
                strokeDasharray="2 5"
              />
            );
          })}
          {notes.map((note) => (
            <rect
              key={note.noteId}
              x={GUTTER + (note.startTick / durationTicks) * (WIDTH - GUTTER)}
              y={((maxPitch - note.pitch) / rows) * HEIGHT + 1}
              width={Math.max(
                2,
                (note.durationTicks / durationTicks) * (WIDTH - GUTTER),
              )}
              height={Math.max(2, HEIGHT / rows - 2)}
              rx={3}
              fill="var(--color-accent-2)"
              stroke="var(--color-accent-2)"
            />
          ))}
        </svg>
      </div>
      <ol className="sr-only">
        {notes.map((note) => (
          <li key={note.noteId}>
            {midiPitchName(note.pitch)}, tick {note.startTick}, duration{" "}
            {note.durationTicks} ticks, velocity {note.velocity}
          </li>
        ))}
      </ol>
    </section>
  );
}
