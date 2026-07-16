const TRACKS: readonly {
  name: string;
  color: string;
  notes: readonly number[];
}[] = [
  { name: "Drums", color: "bg-accent", notes: [0, 2, 4, 6, 8, 10, 12, 14] },
  { name: "Bass", color: "bg-accent-2", notes: [0, 3, 7, 10, 12] },
  { name: "Keys", color: "bg-berry", notes: [1, 5, 9, 13] },
  { name: "Lead", color: "bg-warning", notes: [2, 6, 8, 11, 15] },
];

export function HeroMidiGrid() {
  return (
    <div className="border-subtle bg-surface-raised relative overflow-hidden rounded-[22px] border p-5 shadow-xl">
      <div className="text-muted flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10.5px] tracking-[0.14em] uppercase">
        <span className="text-accent-2 flex items-center gap-2">
          <span className="bg-accent-2 h-[7px] w-[7px] rounded-full shadow-[0_0_10px_var(--color-accent-2)]" />
          Playing MIDI
        </span>
        <span>4 tracks</span>
        <span>124 BPM · Am</span>
        <span className="text-ink ml-auto">Midnight Loop</span>
      </div>
      <ol className="mt-5 space-y-2" aria-label="Example MIDI arrangement">
        {TRACKS.map((track) => (
          <li
            key={track.name}
            className="grid grid-cols-[5rem_1fr] items-center gap-3"
          >
            <span className="text-muted text-xs font-semibold">
              {track.name}
            </span>
            <span
              aria-hidden="true"
              className="border-subtle bg-canvas grid h-12 grid-cols-16 items-center gap-1 rounded-lg border p-1.5"
            >
              {Array.from({ length: 16 }, (_, step) => (
                <span
                  key={step}
                  className={`h-3 rounded-sm ${track.notes.includes(step) ? track.color : "bg-surface-soft"}`}
                />
              ))}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
