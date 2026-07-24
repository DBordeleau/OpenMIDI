import { Container } from "@/components/layout/container";

/** Mirrors the real page so the swap to content is a fill, not a relayout. */
export default function ProjectsLoading() {
  return (
    <main id="main-content">
      <Container className="py-6 sm:py-10" aria-busy="true">
        <p className="sr-only" role="status">
          Loading your projects…
        </p>

        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <p className="text-accent-2 font-mono text-[11px] tracking-[0.2em] uppercase">
              Your music workspace
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-balance sm:text-3xl">
              My projects
            </h1>
          </div>
          <span
            aria-hidden="true"
            className="border-strong bg-surface h-11 w-32 rounded-full border"
          />
        </header>

        <div
          aria-hidden="true"
          className="dash-card rounded-card mt-5 flex animate-pulse flex-wrap gap-1.5 p-2"
        >
          {[26, 30, 28].map((width) => (
            <span
              key={width}
              className="bg-ink/10 h-9 rounded-full"
              style={{ width: `${width}%`, maxWidth: "11rem" }}
            />
          ))}
        </div>

        <div aria-hidden="true" className="mt-6 px-1">
          <span className="bg-ink/10 block h-4 w-56 rounded" />
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
              <div className="flex items-center gap-1.5">
                <span className="bg-ink/10 h-4 w-16 rounded-full" />
                <span className="bg-ink/10 ml-auto h-4 w-12 rounded-full" />
              </div>
              <span className="bg-ink/10 h-6 w-3/4 rounded" />
              <span className="bg-ink/10 h-3.5 w-full rounded" />
              <span className="bg-ink/10 h-3.5 w-2/3 rounded" />
              <span className="bg-ink/10 h-3 w-1/2 rounded" />
              <span className="bg-ink/10 mt-2 h-10 w-36 rounded-full" />
            </li>
          ))}
        </ul>
      </Container>
    </main>
  );
}
