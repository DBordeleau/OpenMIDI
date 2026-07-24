import { Container } from "@/components/layout/container";

function Pulse({ className }: { className: string }) {
  return <span className={`bg-ink/10 block rounded ${className}`} />;
}

export function PublicProjectDetailLoading({
  overlay = false,
}: {
  overlay?: boolean;
}) {
  const Root = overlay ? "div" : "main";
  return (
    <Root id={overlay ? undefined : "main-content"} aria-busy="true">
      <Container className="py-6 sm:py-10">
        <p className="sr-only" role="status">
          Loading project details…
        </p>

        <div
          aria-hidden="true"
          className="animate-pulse motion-reduce:animate-none"
        >
          <Pulse className="h-5 w-32" />

          <header className="challenge-hero rounded-card mt-4 overflow-hidden p-5 sm:p-8">
            <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:gap-8">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <Pulse className="h-5 w-16 rounded-full" />
                  <Pulse className="h-5 w-24 rounded-full" />
                  <Pulse className="h-5 w-36 rounded-full" />
                </div>
                <Pulse className="mt-5 h-11 w-full max-w-xl" />
                <div className="mt-4 flex items-center gap-2.5">
                  <Pulse className="size-10 shrink-0 rounded-full" />
                  <Pulse className="h-4 w-40" />
                </div>
                <Pulse className="mt-5 h-4 w-full max-w-2xl" />
                <Pulse className="mt-2 h-4 w-3/4 max-w-xl" />
                <div className="mt-6 flex flex-wrap gap-2">
                  {[16, 14, 14, 16, 14, 14, 16].map((width, index) => (
                    <Pulse
                      key={`${width}-${index}`}
                      className={`rounded-control h-12 ${width === 16 ? "w-16" : "w-14"}`}
                    />
                  ))}
                </div>
              </div>
              <div className="border-subtle bg-surface-soft/60 rounded-card min-w-0 border p-5">
                <div className="flex items-center gap-3">
                  <Pulse className="size-11 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <Pulse className="h-4 w-32" />
                    <Pulse className="mt-2 h-3 w-20" />
                  </div>
                </div>
                <Pulse className="mt-8 h-2 w-full rounded-full" />
                <Pulse className="mt-5 h-4 w-20" />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Pulse className="h-11 w-44 rounded-full" />
              <Pulse className="h-11 w-48 rounded-full" />
              <Pulse className="h-11 w-48 rounded-full" />
            </div>
          </header>

          <section className="dash-card rounded-card mt-4 min-w-0 p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <Pulse className="h-3 w-24" />
              <Pulse className="h-3 w-32" />
            </div>
            <div className="mt-5 grid min-w-0 gap-3">
              {[0, 1, 2].map((track) => (
                <div
                  key={track}
                  className="border-subtle grid min-w-0 grid-cols-[5rem_minmax(0,1fr)] gap-3 border-t pt-3"
                >
                  <div>
                    <Pulse className="h-3 w-16" />
                    <Pulse className="mt-2 h-3 w-12" />
                  </div>
                  <div className="bg-surface-soft relative h-10 min-w-0 overflow-hidden rounded">
                    <Pulse className="absolute top-1.5 left-[8%] h-7 w-[42%]" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] lg:items-start">
            <section className="dash-card rounded-card min-w-0 p-5 sm:p-6">
              <Pulse className="h-3 w-32" />
              <Pulse className="mt-2 h-6 w-48" />
              <div className="mt-6 grid gap-6">
                {[0, 1].map((revision) => (
                  <div
                    key={revision}
                    className="border-subtle min-w-0 border-l pl-5"
                  >
                    <div className="flex flex-wrap gap-2">
                      <Pulse className="h-3 w-24" />
                      <Pulse className="h-3 w-20" />
                    </div>
                    <Pulse className="mt-3 h-4 w-full max-w-lg" />
                    <Pulse className="mt-2 h-4 w-3/4 max-w-md" />
                    <Pulse className="mt-4 h-4 w-36" />
                  </div>
                ))}
              </div>
            </section>
            <aside className="grid min-w-0 gap-4">
              {[0, 1, 2].map((card) => (
                <section
                  key={card}
                  className="dash-card rounded-card min-w-0 p-5"
                >
                  <Pulse className="h-3 w-20" />
                  <Pulse className="mt-2 h-6 w-52 max-w-full" />
                  <Pulse className="mt-5 h-4 w-full" />
                  <Pulse className="mt-3 h-4 w-4/5" />
                </section>
              ))}
            </aside>
          </div>
        </div>
      </Container>
    </Root>
  );
}
