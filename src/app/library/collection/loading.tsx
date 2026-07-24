import { Container } from "@/components/layout/container";

export default function ClipCollectionLoading() {
  return (
    <main id="main-content">
      <Container className="py-6 sm:py-10" aria-busy="true">
        <p className="sr-only" role="status">
          Loading your clip collection…
        </p>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-accent-2 font-mono text-[11px] tracking-[0.2em] uppercase">
              Your collection
            </p>
            <div className="bg-ink/10 mt-2 h-8 w-72 max-w-full rounded-full" />
          </div>
          <div className="border-strong bg-surface h-11 w-32 rounded-full border" />
        </header>
        <div className="dash-card rounded-card mt-5 h-16 animate-pulse" />
        <div className="bg-ink/10 mt-6 h-4 w-64 max-w-full rounded-full" />
        <ul
          aria-hidden
          className="mt-3 grid animate-pulse gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <li
              key={item}
              className="dash-card rounded-card min-h-80 p-4 sm:p-5"
            >
              <div className="bg-ink/10 h-5 w-24 rounded-full" />
              <div className="bg-ink/10 mt-4 h-6 w-3/4 rounded-full" />
              <div className="bg-ink/10 mt-2 h-4 w-1/2 rounded-full" />
              <div className="border-subtle bg-surface-soft/60 rounded-card mt-4 h-20 border" />
              <div className="bg-ink/10 mt-4 h-6 w-full rounded-full" />
              <div className="bg-ink/10 mt-8 h-11 w-32 rounded-full" />
            </li>
          ))}
        </ul>
      </Container>
    </main>
  );
}
