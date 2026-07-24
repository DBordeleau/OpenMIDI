import { Container } from "@/components/layout/container";

const PIANO_ROLL_NOTE_CLASSES = [
  "h-[40%]",
  "h-[65%]",
  "h-[48%]",
  "h-[82%]",
  "h-[58%]",
  "h-[72%]",
  "h-[45%]",
  "h-[62%]",
] as const;

function Pulse({ className }: { className: string }) {
  return <span className={`bg-ink/10 block rounded ${className}`} />;
}

export function MidiLibraryDetailLoading({
  overlay = false,
}: {
  overlay?: boolean;
}) {
  const Root = overlay ? "div" : "main";
  return (
    <Root id={overlay ? undefined : "main-content"} aria-busy="true">
      <Container className="py-16 sm:py-20">
        <p className="sr-only" role="status">
          Loading MIDI pattern details…
        </p>

        <div
          aria-hidden="true"
          className="animate-pulse motion-reduce:animate-none"
        >
          <Pulse className="h-5 w-32" />
          <article className="mt-7 min-w-0">
            <Pulse className="h-3 w-52 max-w-full" />
            <div className="mt-4 flex min-w-0 flex-wrap items-start justify-between gap-5">
              <div className="min-w-0 flex-1">
                <Pulse className="h-12 w-full max-w-xl" />
                <div className="mt-4 flex items-center gap-2">
                  <Pulse className="size-9 shrink-0 rounded-full" />
                  <Pulse className="h-4 w-48 max-w-[70%]" />
                </div>
              </div>
              <Pulse className="h-10 w-52 max-w-full rounded-full" />
            </div>
            <Pulse className="mt-6 h-5 w-full max-w-2xl" />

            <section className="border-strong bg-surface rounded-card mt-8 min-w-0 border p-5 sm:p-6">
              <Pulse className="h-3 w-28" />
              <Pulse className="mt-3 h-8 w-72 max-w-full" />
              <Pulse className="mt-4 h-4 w-full" />
              <Pulse className="mt-2 h-4 w-3/4" />
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {[0, 1, 2, 3].map((item) => (
                  <div key={item}>
                    <Pulse className="h-3 w-20" />
                    <Pulse className="mt-2 h-4 w-40 max-w-full" />
                  </div>
                ))}
              </div>
            </section>

            <section className="border-subtle rounded-card mt-6 min-w-0 border p-5">
              <Pulse className="h-6 w-64 max-w-full" />
              <Pulse className="mt-3 h-4 w-full max-w-2xl" />
              <Pulse className="mt-2 h-4 w-2/3 max-w-xl" />
              <Pulse className="mt-5 h-11 w-44 rounded-full" />
            </section>

            <section className="border-subtle bg-surface rounded-card mt-6 min-w-0 border p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-4">
                <Pulse className="size-12 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <Pulse className="h-5 w-48 max-w-full" />
                  <Pulse className="mt-2 h-3 w-32" />
                </div>
              </div>
              <Pulse className="mt-7 h-2 w-full rounded-full" />
            </section>

            <dl className="border-subtle rounded-card mt-6 grid min-w-0 gap-4 border p-5 sm:grid-cols-3 lg:grid-cols-6">
              {[0, 1, 2, 3, 4, 5].map((item) => (
                <div key={item}>
                  <Pulse className="h-3 w-20" />
                  <Pulse className="mt-2 h-4 w-24 max-w-full" />
                </div>
              ))}
            </dl>

            <section className="border-subtle rounded-card mt-6 min-w-0 overflow-hidden border p-5">
              <Pulse className="h-7 w-48" />
              <Pulse className="mt-3 h-4 w-64 max-w-full" />
              <div className="bg-surface-soft mt-5 h-48 min-w-0 rounded">
                <div className="grid h-full grid-cols-8 items-end gap-2 p-4">
                  {PIANO_ROLL_NOTE_CLASSES.map((heightClass) => (
                    <span
                      key={heightClass}
                      className={`bg-accent/15 rounded-t ${heightClass}`}
                    />
                  ))}
                </div>
              </div>
            </section>

            <div className="mt-10 grid min-w-0 gap-6 lg:grid-cols-2">
              {[0, 1].map((card) => (
                <section
                  key={card}
                  className="border-subtle bg-surface rounded-card min-w-0 border p-6"
                >
                  <Pulse className="h-3 w-44 max-w-full" />
                  <Pulse className="mt-3 h-8 w-72 max-w-full" />
                  <Pulse className="mt-4 h-4 w-full" />
                  <Pulse className="mt-6 h-4 w-48 max-w-full" />
                  <Pulse className="mt-3 h-4 w-36" />
                </section>
              ))}
            </div>

            <section className="mt-10 min-w-0">
              <Pulse className="h-8 w-64 max-w-full" />
              <div className="mt-4 grid gap-3">
                {[0, 1].map((version) => (
                  <div
                    key={version}
                    className="border-subtle rounded-control grid min-w-0 gap-3 border p-4 sm:grid-cols-[8rem_minmax(0,1fr)_auto]"
                  >
                    <Pulse className="h-4 w-24" />
                    <Pulse className="h-4 w-40 max-w-full" />
                    <Pulse className="h-4 w-28" />
                  </div>
                ))}
              </div>
            </section>
          </article>
        </div>
      </Container>
    </Root>
  );
}
