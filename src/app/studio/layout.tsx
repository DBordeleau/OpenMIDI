import Link from "next/link";
import { Container } from "@/components/layout/container";

export default function StudioLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main id="main-content">
      <Container className="py-8 sm:py-10">
        <div className="mx-auto max-w-6xl space-y-8">
          <header className="border-subtle bg-surface/90 rounded-card flex flex-wrap items-center justify-between gap-4 border px-5 py-4 shadow-lg backdrop-blur-sm sm:px-6">
            <div>
              <Link
                href="/studio"
                className="hover:text-accent text-lg font-bold tracking-tight transition-colors"
              >
                Jam Session Studio
              </Link>
              <p className="text-muted mt-1 text-sm">
                One project, one live session, all the music in context.
              </p>
            </div>
            <nav aria-label="Studio" className="flex flex-wrap gap-2">
              <Link
                href="/projects"
                className="border-strong hover:border-accent hover:text-accent inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors"
              >
                Open project
              </Link>
              <Link
                href="/projects/new"
                className="cta-gradient text-accent-contrast inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-transform hover:-translate-y-px"
              >
                New project
              </Link>
            </nav>
          </header>
          {children}
        </div>
      </Container>
    </main>
  );
}
