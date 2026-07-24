import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal.client";
import { getOptionalViewer } from "@/features/auth/guards";
import { LibraryFilters } from "@/features/midi-library/library-filters";
import { ListingCard } from "@/features/midi-library/listing-card";
import { formatInstrumentFamily } from "@/features/midi-library/rights";
import {
  midiLibrarySearchParams,
  parseMidiLibraryFilters,
} from "@/features/midi-library/schema";
import {
  listMidiLibraryOptions,
  listOwnedPrivateMidiWorkspaces,
  listSavedMidiLibraryPatternIds,
  searchPublicMidiLibrary,
} from "@/server/repositories/midi-library";

type PageSearchParams = Record<string, string | string[] | undefined>;
export const metadata: Metadata = {
  title: "MIDI library",
  description:
    "Explore exact rights-attested MIDI pattern versions with browser-local preview.",
};

export default async function MidiLibraryPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const parsed = parseMidiLibraryFilters(await searchParams);
  const viewer = await getOptionalViewer();
  const [options, workspaces] = await Promise.all([
    listMidiLibraryOptions(),
    viewer ? listOwnedPrivateMidiWorkspaces() : Promise.resolve([]),
  ]);
  let result: Awaited<ReturnType<typeof searchPublicMidiLibrary>> | null = null;
  let error = parsed.success ? null : parsed.message;
  if (parsed.success)
    try {
      result = await searchPublicMidiLibrary(parsed.data);
    } catch (cause) {
      error =
        cause instanceof Error && cause.message === "midi_library_cursor_stale"
          ? "The catalog changed while you were browsing. Start again from the first page."
          : "The library is taking a moment to tune up. Try again.";
    }
  const savedIds = new Set(
    viewer && result
      ? await listSavedMidiLibraryPatternIds(
          result.listings.map((item) => item.midiPatternVersionId),
        )
      : [],
  );
  const filters = parsed.success ? parsed.data : null;
  const families = [
    ...new Set(options.presets.map((preset) => preset.family)),
  ].map((family) => ({ value: family, label: formatInstrumentFamily(family) }));
  const nextHref =
    filters && result?.nextCursor
      ? `/library?${midiLibrarySearchParams({ ...filters, after: result.nextCursor })}`
      : null;

  return (
    <main id="main-content">
      {/* Tight top rhythm on purpose: the point of this page is the patterns,
          and the old header pushed every card below the fold on a 1080p
          display. */}
      <Container className="py-6 sm:py-10">
        <Reveal>
          <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div>
              <p className="text-accent-2 font-mono text-[11px] tracking-[0.2em] uppercase">
                MIDI library
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-balance sm:text-3xl">
                Find a pattern.{" "}
                <em className="text-accent font-serif font-medium">
                  {/* Only one of these is ever displayed, so only one reaches
                      assistive technology. */}
                  <span className="sm:hidden">Hear it.</span>
                  <span className="hidden sm:inline">
                    Hear the possibility.
                  </span>
                </em>
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              {viewer && (
                <ButtonLink
                  href="/library/saved"
                  variant="secondary"
                  prefetch={false}
                >
                  Saved clips
                </ButtonLink>
              )}
              <ButtonLink
                href="/library/manage"
                variant="secondary"
                prefetch={false}
              >
                List your MIDI
              </ButtonLink>
            </div>
          </header>
        </Reveal>

        {filters && (
          <Reveal delay={0.06} className="mt-5">
            <LibraryFilters
              filters={filters}
              categories={options.categories.map((item) => ({
                value: item.code,
                label: item.name,
              }))}
              families={families}
              presets={options.presets.map((item) => ({
                value: item.id,
                label: `${item.name} · ${formatInstrumentFamily(item.family)}`,
              }))}
              tags={options.tags.map((item) => ({
                value: item.code,
                label: item.name,
              }))}
            />
          </Reveal>
        )}

        {error ? (
          <MessageState
            title="That search needs another take."
            message={error}
          />
        ) : result?.listings.length ? (
          <section className="mt-7" aria-labelledby="library-results">
            <Reveal
              delay={0.1}
              className="flex flex-wrap items-baseline justify-between gap-3 px-1"
            >
              <h2 id="library-results" className="text-muted text-sm">
                <span className="text-ink font-semibold">
                  {result.listings.length} pattern
                  {result.listings.length === 1 ? "" : "s"}
                </span>{" "}
                · sorted by{" "}
                {filters?.sort === "name" ? "name" : "recent listing"}
              </h2>
            </Reveal>
            <ul className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {result.listings.map((listing, index) => (
                <Reveal
                  as="li"
                  key={listing.listingId}
                  // Capped so a full page of results still finishes arriving
                  // quickly instead of trickling in for two seconds.
                  delay={0.14 + Math.min(index, 8) * 0.05}
                  className="flex"
                >
                  <ListingCard
                    listing={listing}
                    viewerSignedIn={Boolean(viewer)}
                    saved={savedIds.has(listing.midiPatternVersionId)}
                    workspaces={workspaces}
                  />
                </Reveal>
              ))}
            </ul>
            {nextHref && (
              <div className="mt-8 text-center">
                <Link
                  prefetch={false}
                  className="border-strong hover:border-accent hover:text-accent inline-flex min-h-11 items-center rounded-full border px-6 font-semibold transition-colors"
                  href={nextHref}
                >
                  Next patterns
                </Link>
              </div>
            )}
          </section>
        ) : (
          <MessageState
            title="No patterns in that pocket yet."
            message="Try All rights modes, a wider musical range, or fewer filters."
          />
        )}
      </Container>
    </main>
  );
}

function MessageState({ title, message }: { title: string; message: string }) {
  return (
    <section className="rounded-card border-strong mt-7 border border-dashed p-10 text-center">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="text-muted mt-2">{message}</p>
      <Link
        prefetch={false}
        className="text-accent mt-4 inline-flex font-semibold"
        href="/library"
      >
        Return to all patterns →
      </Link>
    </section>
  );
}
