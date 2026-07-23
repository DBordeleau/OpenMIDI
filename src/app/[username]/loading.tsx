import { Container } from "@/components/layout/container";

export default function PublicProfileLoading() {
  return (
    <main id="main-content" aria-busy="true" aria-label="Loading profile">
      <Container className="py-6 sm:py-10">
        <div className="mx-auto max-w-6xl animate-pulse motion-reduce:animate-none">
          <div className="dash-card rounded-card border-subtle grid gap-5 border p-4 sm:p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:p-6">
            <div className="grid gap-4 min-[23rem]:grid-cols-[auto_minmax(0,1fr)] sm:gap-5">
              <div className="bg-surface-raised size-28 rounded-full" />
              <div className="min-w-0">
                <div className="bg-surface-raised h-9 max-w-xs rounded-full" />
                <div className="bg-surface-raised mt-3 h-4 w-32 rounded-full" />
                <div className="bg-surface-raised mt-4 h-4 max-w-md rounded-full" />
                <div className="border-subtle mt-4 border-t pt-4">
                  <div className="bg-surface-raised h-3 w-24 rounded-full" />
                  <div className="bg-surface-raised mt-2 h-4 w-36 rounded-full" />
                </div>
              </div>
            </div>
            <div className="border-subtle border-t pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
              <div className="bg-surface-raised h-6 w-32 rounded-full" />
              <div className="bg-surface-raised mt-4 h-4 max-w-xs rounded-full" />
            </div>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
            <div className="grid gap-3">
              <div className="bg-surface-raised h-9 w-48 rounded-full" />
              <div className="dash-card rounded-card border-subtle h-24 border" />
              <div className="dash-card rounded-card border-subtle h-24 border" />
            </div>
            <div className="grid content-start gap-3">
              <div className="bg-surface-raised h-9 w-56 rounded-full" />
              <div className="dash-card rounded-card border-subtle h-24 border" />
            </div>
          </div>
        </div>
      </Container>
    </main>
  );
}
