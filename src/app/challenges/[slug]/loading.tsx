import { Container } from "@/components/layout/container";

/**
 * Mirrors the real page's shape — hero, schedule track, two-up rules — so the
 * swap to content is a fill rather than a relayout.
 */
export default function ChallengeLoading() {
  return (
    <main id="main-content">
      <Container className="py-6 sm:py-10" aria-busy="true">
        <p className="sr-only" role="status">
          Loading the challenge…
        </p>

        <div aria-hidden="true" className="animate-pulse">
          <span className="bg-ink/10 block h-4 w-32 rounded" />

          <div className="challenge-hero rounded-card relative mt-4 overflow-hidden p-5 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="border-subtle h-6 w-20 rounded-full border" />
              <span className="bg-ink/10 h-4 w-40 rounded" />
            </div>
            <span className="bg-ink/10 mt-5 block h-11 w-3/4 max-w-2xl rounded" />
            <span className="bg-ink/10 mt-4 block h-6 w-1/2 max-w-md rounded" />
            <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] lg:items-start">
              <div className="grid max-w-2xl gap-2.5">
                <span className="bg-ink/10 h-3.5 w-full rounded" />
                <span className="bg-ink/10 h-3.5 w-full rounded" />
                <span className="bg-ink/10 h-3.5 w-2/3 rounded" />
              </div>
              <span className="border-subtle bg-surface-soft/60 rounded-card block h-24 border" />
            </div>
          </div>

          <div className="dash-card rounded-card mt-4 p-5 sm:p-6">
            <span className="bg-ink/10 block h-3 w-32 rounded" />
            <div className="mt-5 grid gap-5 sm:grid-cols-4 sm:gap-4">
              {[0, 1, 2, 3].map((stage) => (
                <div key={stage} className="grid gap-2">
                  <span className="bg-ink/10 h-2.5 w-full rounded-full" />
                  <span className="bg-ink/10 h-4 w-24 rounded" />
                  <span className="bg-ink/10 h-3 w-16 rounded" />
                </div>
              ))}
            </div>
          </div>

          <span className="bg-ink/10 mt-8 ml-1 block h-3 w-44 rounded" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((rule) => (
              <span
                key={rule}
                className="dash-card rounded-card block h-16 sm:h-[4.75rem]"
              />
            ))}
          </div>
        </div>
      </Container>
    </main>
  );
}
