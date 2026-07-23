import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { Reveal } from "@/components/ui/reveal.client";
import { DiscoveryFilters } from "@/features/discovery/discovery-filters";
import { DiscoveryProjectCard } from "@/features/discovery/discovery-project-card";
import {
  discoverySearchParams,
  parseDiscoveryFilters,
} from "@/features/discovery/schema";
import {
  listDiscoveryOptions,
  searchPublicProjects,
} from "@/server/repositories/discovery";

type PageSearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}): Promise<Metadata> {
  const parsed = parseDiscoveryFilters(await searchParams);
  const query = parsed.success
    ? discoverySearchParams(parsed.data).toString()
    : "";
  return {
    title: "Explore projects",
    description: "Find public music projects ready for a fresh perspective.",
    alternates: { canonical: query ? `/explore?${query}` : "/explore" },
  };
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const parsed = parseDiscoveryFilters(await searchParams);
  const options = await listDiscoveryOptions();
  let result: Awaited<ReturnType<typeof searchPublicProjects>> | null = null;
  let error = parsed.success ? null : parsed.message;
  if (parsed.success) {
    try {
      result = await searchPublicProjects(parsed.data);
    } catch (cause) {
      error =
        cause instanceof Error && cause.message === "discovery_cursor_stale"
          ? "Projects changed while you were browsing. Start again from the first page."
          : "Projects are taking a moment to tune up. Please try again.";
    }
  }
  const filters = parsed.success ? parsed.data : null;
  const nextHref =
    filters && result?.nextCursor
      ? "/explore?" +
        discoverySearchParams({
          ...filters,
          after: result.nextCursor,
        }).toString()
      : null;

  return (
    <main id="main-content">
      <Container className="py-6 sm:py-10">
        <Reveal>
          <header>
            <p className="text-accent-2 font-mono text-[11px] tracking-[0.2em] uppercase">
              Public projects
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-balance sm:text-3xl">
              Find a session.{" "}
              <em className="text-accent font-serif font-medium">
                Make it yours.
              </em>
            </h1>
            <p className="text-muted mt-2 max-w-[58ch] text-sm sm:text-base">
              Hear playable MIDI arrangements, follow the artists behind them,
              and find the idea you want to take further.
            </p>
          </header>
        </Reveal>

        {filters && (
          <Reveal delay={0.06} className="mt-5">
            <DiscoveryFilters filters={filters} options={options} />
          </Reveal>
        )}

        {error ? (
          <MessageState
            title="That search needs another take."
            message={error}
          />
        ) : result?.projects.length ? (
          <section className="mt-7" aria-labelledby="results-heading">
            <Reveal
              delay={0.1}
              className="flex flex-wrap items-baseline justify-between gap-3 px-1"
            >
              <h2 id="results-heading" className="text-muted text-sm">
                <span className="text-ink font-semibold">
                  {result.projects.length} project
                  {result.projects.length === 1 ? "" : "s"}
                </span>{" "}
                · sorted by{" "}
                {filters?.sort === "trending" ? "momentum" : "recent release"}
              </h2>
              <p className="text-muted hidden text-sm sm:block">
                Preview a project without leaving the page.
              </p>
            </Reveal>
            <ul className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {result.projects.map((project, index) => (
                <Reveal
                  as="li"
                  key={project.projectId}
                  delay={0.14 + Math.min(index, 8) * 0.05}
                  className="flex"
                >
                  <DiscoveryProjectCard project={project} />
                </Reveal>
              ))}
            </ul>
            {nextHref && (
              <div className="mt-8 text-center">
                <Link
                  className="border-strong hover:border-accent hover:text-accent inline-flex min-h-11 items-center rounded-full border px-6 font-semibold transition-colors"
                  href={nextHref}
                >
                  Next projects
                </Link>
              </div>
            )}
          </section>
        ) : (
          <MessageState
            title="No projects in that pocket yet."
            message="Try a wider tempo range, another instrument, or fewer filters."
          />
        )}
      </Container>
    </main>
  );
}

function MessageState({ title, message }: { title: string; message: string }) {
  return (
    <Reveal
      as="section"
      delay={0.1}
      className="dash-card rounded-card mt-7 border border-dashed p-8 text-center sm:p-10"
    >
      <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
      <p className="text-muted mt-2">{message}</p>
      <Link
        className="text-accent mt-4 inline-flex font-semibold"
        href="/explore"
      >
        Return to all projects →
      </Link>
    </Reveal>
  );
}
