import { Container } from "@/components/layout/container";

/**
 * Mirrors the real page's shape — compact header, one toolbar, a three-column
 * card grid — so the swap to content is a fill rather than a relayout. The old
 * skeleton showed a different heading and three bare blocks, which made the
 * page appear to jump when results arrived.
 */
function CardSkeleton() {
  return (
    <li className="dash-card rounded-card flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="bg-ink/10 h-4 w-28 rounded-full" />
        <span className="bg-ink/10 ml-auto h-4 w-16 rounded-full" />
      </div>
      <span className="bg-ink/10 h-6 w-3/4 rounded" />
      <span className="bg-ink/10 h-3.5 w-1/2 rounded" />
      <div className="border-subtle bg-surface-soft/60 rounded-card flex items-center gap-3 border p-3">
        <span className="bg-ink/10 size-11 shrink-0 rounded-full" />
        <span className="bg-ink/10 rounded-control h-9 flex-1" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[16, 14, 20, 12].map((width) => (
          <span
            key={width}
            className="bg-ink/10 h-5 rounded-full"
            style={{ width: `${width}%` }}
          />
        ))}
      </div>
      <span className="bg-ink/10 h-3.5 w-full rounded" />
      <span className="bg-ink/10 h-3.5 w-2/3 rounded" />
    </li>
  );
}

export default function LibraryLoading() {
  return (
    <main id="main-content">
      <Container className="py-6 sm:py-10" aria-busy="true">
        <p className="sr-only" role="status">
          Loading the MIDI library…
        </p>

        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <p className="text-accent-2 font-mono text-[11px] tracking-[0.2em] uppercase">
              MIDI library
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-balance sm:text-3xl">
              Find a pattern.{" "}
              <em className="text-accent font-serif font-medium">
                <span className="sm:hidden">Hear it.</span>
                <span className="hidden sm:inline">Hear the possibility.</span>
              </em>
            </h1>
          </div>
          <div className="flex gap-2" aria-hidden="true">
            <span className="border-strong bg-surface h-11 w-28 rounded-full border" />
            <span className="border-strong bg-surface h-11 w-32 rounded-full border" />
          </div>
        </header>

        <div
          aria-hidden="true"
          className="dash-card rounded-card mt-5 grid animate-pulse gap-3 p-3 sm:p-4"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="border-strong bg-surface-soft rounded-control h-11 min-w-48 flex-1 border" />
            <span className="border-strong bg-surface-soft rounded-control h-11 w-40 border" />
            <span className="bg-ink/10 h-11 w-28 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="border-subtle h-9 w-16 rounded-full border" />
            <span className="border-subtle h-9 w-24 rounded-full border" />
            <span className="border-subtle h-9 w-24 rounded-full border" />
            <span className="border-subtle ml-auto h-9 w-32 rounded-full border" />
          </div>
        </div>

        {/* Matches the real page: results line at mt-7, grid at mt-3. */}
        <div aria-hidden="true" className="mt-7 px-1">
          <span className="bg-ink/10 block h-4 w-56 rounded" />
        </div>
        <ul
          aria-hidden="true"
          className="mt-3 grid animate-pulse gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <CardSkeleton key={item} />
          ))}
        </ul>
      </Container>
    </main>
  );
}
