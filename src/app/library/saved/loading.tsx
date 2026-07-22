import { Container } from "@/components/layout/container";

/** Mirrors the real page so the swap to content is a fill, not a relayout. */
export default function SavedClipsLoading() {
  return (
    <main id="main-content">
      <Container className="py-6 sm:py-10" aria-busy="true">
        <p className="sr-only" role="status">
          Loading your saved clips…
        </p>

        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <p className="text-accent-2 font-mono text-[11px] tracking-[0.2em] uppercase">
              Private collection
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-balance sm:text-3xl">
              <span className="sm:hidden">
                Clips you{" "}
                <em className="text-accent font-serif font-medium">kept</em>.
              </span>
              <span className="hidden sm:inline">
                Clips you kept, exactly as{" "}
                <em className="text-accent font-serif font-medium">written</em>.
              </span>
            </h1>
          </div>
          <span
            aria-hidden="true"
            className="border-strong bg-surface h-11 w-44 rounded-full border"
          />
        </header>

        <div aria-hidden="true" className="mt-6 px-1">
          <span className="bg-ink/10 block h-4 w-72 rounded" />
        </div>
        <ul
          aria-hidden="true"
          className="mt-3 grid animate-pulse gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <li
              key={item}
              className="dash-card rounded-card flex flex-col gap-3 p-4 sm:p-5"
            >
              <div className="flex items-center gap-2">
                <span className="bg-ink/10 h-4 w-20 rounded-full" />
                <span className="bg-ink/10 ml-auto h-4 w-16 rounded-full" />
              </div>
              <span className="bg-ink/10 h-6 w-3/4 rounded" />
              <span className="bg-ink/10 h-3.5 w-1/2 rounded" />
              <div className="border-subtle bg-surface-soft/60 rounded-card flex items-center gap-3 border p-3">
                <span className="bg-ink/10 size-11 shrink-0 rounded-full" />
                <span className="bg-ink/10 rounded-control h-9 flex-1" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[16, 14, 24, 22].map((width) => (
                  <span
                    key={width}
                    className="bg-ink/10 h-5 rounded-full"
                    style={{ width: `${width}%` }}
                  />
                ))}
              </div>
              <span className="bg-ink/10 mt-2 h-10 w-full rounded-full" />
            </li>
          ))}
        </ul>
      </Container>
    </main>
  );
}
