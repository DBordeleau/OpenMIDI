import type { MidiLibraryNote } from "./types";

/**
 * A miniature piano roll drawn from the pattern's actual notes — pitch on the
 * vertical axis, tick position and length on the horizontal, velocity in the
 * alpha. Not a fake audio waveform: the listing already carries the note data,
 * and brand.md §5 asks musical surfaces to show note timing rather than
 * invented bars.
 */
export function PatternRoll({
  notes,
  durationTicks,
  className = "",
}: {
  notes: MidiLibraryNote[];
  durationTicks: number;
  className?: string;
}) {
  if (!notes.length)
    return (
      <div
        aria-hidden="true"
        className={`bg-surface-soft/80 border-subtle rounded-control border ${className}`}
      />
    );

  const span = Math.max(durationTicks, 1);
  const pitches = notes.map((note) => note.pitch);
  const lowest = Math.min(...pitches);
  const highest = Math.max(...pitches);
  // +1 so a single-pitch pattern still gets a full-height row instead of a
  // zero-height sliver.
  const rows = Math.max(highest - lowest + 1, 1);
  const rowHeight = 100 / rows;

  return (
    <div
      aria-hidden="true"
      className={`bg-surface-soft/80 border-subtle rounded-control relative overflow-hidden border ${className}`}
      style={{
        backgroundImage:
          "repeating-linear-gradient(90deg,rgb(255 255 255 / 5%) 0 1px,transparent 1px 12.5%)",
      }}
    >
      {notes.map((note) => (
        <span
          key={note.noteId}
          className="from-accent-2 to-accent absolute rounded-[2px] bg-linear-to-r"
          style={{
            left: `${(note.startTick / span) * 100}%`,
            width: `${Math.max((note.durationTicks / span) * 100, 0.8)}%`,
            top: `${(highest - note.pitch) * rowHeight}%`,
            height: `${Math.max(rowHeight, 9)}%`,
            // Velocity is real data, so let it read as dynamics.
            opacity: 0.45 + (note.velocity / 127) * 0.55,
          }}
        />
      ))}
    </div>
  );
}
