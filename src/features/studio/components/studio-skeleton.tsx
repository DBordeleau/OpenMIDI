/**
 * A full-height placeholder that mirrors the arranger frame (toolbar, ruler,
 * channel lanes, footer). Shown while the studio surface lazily imports or the
 * environment support check runs, so switching a project reads as the workspace
 * assembling rather than a blank text flash that snaps into the arranger. The
 * `animate-pulse` shimmer is neutralized automatically under
 * `prefers-reduced-motion` by globals.css.
 */
export function StudioSkeleton() {
  return (
    <div
      className="rounded-card border-strong bg-surface flex min-h-0 flex-1 animate-pulse flex-col overflow-hidden border shadow-xl"
      aria-hidden
    >
      <div className="border-subtle bg-surface-raised flex items-center gap-3 border-b p-3">
        <div className="bg-surface-soft h-11 w-11 rounded-full" />
        <div className="bg-surface-soft h-3.5 w-24 rounded-full" />
        <div className="ml-auto flex gap-2">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="bg-surface-soft h-9 w-9 rounded-full" />
          ))}
        </div>
      </div>
      <div className="border-subtle grid grid-cols-[17rem_1fr] border-b">
        <div className="border-subtle border-r p-3">
          <div className="bg-surface-soft h-3 w-16 rounded-full" />
        </div>
        <div className="p-3">
          <div className="bg-surface-soft h-3 w-full rounded-full opacity-40" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="border-subtle grid h-40 grid-cols-[17rem_1fr] border-b"
          >
            <div className="border-subtle space-y-3 border-r p-3">
              <div className="bg-surface-soft h-3 w-28 rounded-full" />
              <div className="bg-surface-soft h-2 w-36 rounded-full opacity-60" />
              <div className="flex gap-2 pt-2">
                <div className="bg-surface-soft h-8 w-8 rounded-full" />
                <div className="bg-surface-soft h-8 w-8 rounded-full" />
              </div>
            </div>
            <div className="p-4">
              <div
                className="bg-surface-soft h-28 rounded-control"
                style={{ marginLeft: `${index * 9}%`, width: "34%" }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="border-subtle bg-surface-raised h-12 border-t" />
      <span className="sr-only" role="status">
        Loading studio…
      </span>
    </div>
  );
}
