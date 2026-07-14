import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import {
  discoverySearchParams,
  parseDiscoveryFilters,
} from "@/features/discovery/schema";
import { musicalKeys } from "@/features/projects/schema";
import { QuickPreviewPlayer } from "@/features/studio/waveform-playlist-adapter/quick-preview-player.client";
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
    title: "Explore projects · Jam Session",
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
      <Container className="py-16 sm:py-20">
        <header className="max-w-3xl">
          <p className="text-accent-2 font-mono text-xs tracking-[0.2em] uppercase">
            Open sessions
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Find the track that needs{" "}
            <em className="text-accent font-serif font-medium">your</em> sound.
          </h1>
          <p className="text-muted mt-5 max-w-[52ch] text-lg">
            Browse public works in progress by tempo, key, style, and the parts
            already in the mix.
          </p>
        </header>

        <form
          action="/explore"
          className="rounded-card border-subtle bg-surface mt-10 grid gap-6 border p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"
        >
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <label className="sm:col-span-2 lg:col-span-4">
              <span className="text-accent font-mono text-[11px] tracking-[0.16em] uppercase">
                Search projects
              </span>
              <input
                className="rounded-control border-strong bg-surface-soft mt-2 min-h-11 w-full border px-4"
                name="q"
                defaultValue={filters?.query ?? ""}
                maxLength={80}
                placeholder="Title, description, or tag"
              />
            </label>
            <FilterGroup
              legend="Genres"
              name="genre"
              selected={filters?.genres ?? []}
              options={options.genres}
            />
            <FilterGroup
              legend="Tags"
              name="tag"
              selected={filters?.tags ?? []}
              options={options.tags}
            />
            <FilterGroup
              legend="Instruments"
              name="instrument"
              selected={filters?.instruments ?? []}
              options={options.instruments}
            />
            <fieldset>
              <legend className="text-accent font-mono text-[11px] tracking-[0.16em] uppercase">
                Musical details
              </legend>
              <div className="mt-2 grid gap-2">
                <select
                  className="rounded-control border-strong bg-surface-soft min-h-11 border px-3"
                  name="key"
                  defaultValue={filters?.keys[0] ?? ""}
                  aria-label="Musical key"
                >
                  <option value="">Any key</option>
                  {musicalKeys.map((key) => (
                    <option key={key} value={key}>
                      {key.replaceAll("-", " ")}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="rounded-control border-strong bg-surface-soft min-h-11 min-w-0 border px-3"
                    name="bpmMin"
                    inputMode="decimal"
                    defaultValue={filters?.bpmMin ?? ""}
                    placeholder="Min BPM"
                    aria-label="Minimum BPM"
                  />
                  <input
                    className="rounded-control border-strong bg-surface-soft min-h-11 min-w-0 border px-3"
                    name="bpmMax"
                    inputMode="decimal"
                    defaultValue={filters?.bpmMax ?? ""}
                    placeholder="Max BPM"
                    aria-label="Maximum BPM"
                  />
                </div>
              </div>
            </fieldset>
          </div>
          <div className="flex flex-wrap items-center gap-3 lg:flex-col lg:items-stretch">
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="open"
                value="1"
                defaultChecked={filters?.openOnly}
              />
              Open to contributions
            </label>
            <select
              className="border-strong bg-surface min-h-11 rounded-full border px-4 text-sm"
              name="sort"
              defaultValue={filters?.sort ?? "recent"}
              aria-label="Sort projects"
            >
              <option value="recent">Most recent</option>
              <option value="trending">Trending</option>
            </select>
            <button className="cta-gradient min-h-11 rounded-full px-6 font-semibold">
              Find projects
            </button>
            <Link
              className="text-muted text-center text-sm underline"
              href="/explore"
            >
              Clear all
            </Link>
          </div>
        </form>

        {error ? (
          <MessageState
            title="That search needs another take."
            message={error}
          />
        ) : result?.projects.length ? (
          <section className="mt-12" aria-labelledby="results-heading">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-accent font-mono text-[11px] tracking-[0.18em] uppercase">
                  Public projects
                </p>
                <h2 id="results-heading" className="mt-1 text-2xl font-bold">
                  {result.projects.length} project
                  {result.projects.length === 1 ? "" : "s"} in this set
                </h2>
              </div>
              <p className="text-muted text-sm">
                Sorted by{" "}
                {filters?.sort === "trending" ? "momentum" : "recent release"}
              </p>
            </div>
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {result.projects.map((project) => (
                <article
                  key={project.projectId}
                  className="rounded-card border-subtle bg-surface-raised flex flex-col border p-6 shadow-[0_24px_60px_-40px_#000]"
                >
                  <div className="flex flex-wrap gap-2 font-mono text-[10px] tracking-wider uppercase">
                    {project.genres.slice(0, 2).map((genre) => (
                      <span className="text-accent" key={genre.id}>
                        {genre.name}
                      </span>
                    ))}
                    {project.openToContributions && (
                      <span className="text-accent-2">Open session</span>
                    )}
                  </div>
                  <h3 className="mt-4 text-2xl font-bold text-balance">
                    <Link href={"/projects/" + project.projectId}>
                      {project.title}
                    </Link>
                  </h3>
                  <p className="text-muted mt-2 text-sm">
                    by{" "}
                    <Link
                      className="underline"
                      href={"/@" + project.ownerUsername}
                    >
                      @{project.ownerUsername}
                    </Link>
                  </p>
                  {project.description && (
                    <p className="text-muted mt-4 line-clamp-3">
                      {project.description}
                    </p>
                  )}
                  <dl className="border-subtle text-muted mt-5 grid grid-cols-3 gap-3 border-t pt-4 text-sm">
                    <Metric
                      label="Tempo"
                      value={project.bpm ? project.bpm + " BPM" : "—"}
                    />
                    <Metric
                      label="Key"
                      value={project.musicalKey?.replaceAll("-", " ") ?? "—"}
                    />
                    <Metric
                      label="Tracks"
                      value={String(project.tracks.length)}
                    />
                  </dl>
                  <QuickPreviewPlayer
                    compact
                    projectId={project.projectId}
                    revisionId={project.currentRevisionId}
                    title={project.title}
                    durationMs={project.durationMs}
                  />
                  <Link
                    className="border-strong hover:border-accent-2 hover:text-accent-2 mt-6 inline-flex min-h-11 items-center justify-center rounded-full border px-5 font-semibold"
                    href={"/projects/" + project.projectId}
                  >
                    Open project
                  </Link>
                </article>
              ))}
            </div>
            {nextHref && (
              <div className="mt-10 text-center">
                <Link
                  className="border-strong hover:border-accent-2 inline-flex min-h-11 items-center rounded-full border px-6 font-semibold"
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

function FilterGroup({
  legend,
  name,
  options,
  selected,
}: {
  legend: string;
  name: string;
  options: Array<{ id: string; slug: string; name: string }>;
  selected: string[];
}) {
  return (
    <fieldset>
      <legend className="text-accent font-mono text-[11px] tracking-[0.16em] uppercase">
        {legend}
      </legend>
      <div className="border-subtle bg-surface-soft rounded-control mt-2 max-h-40 space-y-1 overflow-y-auto border p-3">
        {options.map((option) => (
          <label
            className="flex min-h-8 items-center gap-2 text-sm"
            key={option.id}
          >
            <input
              type="checkbox"
              name={name}
              value={option.slug}
              defaultChecked={selected.includes(option.slug)}
            />
            {option.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase">{label}</dt>
      <dd className="text-ink mt-1">{value}</dd>
    </div>
  );
}

function MessageState({ title, message }: { title: string; message: string }) {
  return (
    <section className="rounded-card border-subtle mt-10 border border-dashed p-10 text-center">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="text-muted mt-2">{message}</p>
      <Link className="mt-4 inline-flex underline" href="/explore">
        Return to all projects
      </Link>
    </section>
  );
}
