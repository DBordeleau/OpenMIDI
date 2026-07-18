import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button";
import {
  midiLibrarySearchParams,
  parseMidiLibraryFilters,
} from "@/features/midi-library/schema";
import { MidiLibraryPreview } from "@/features/midi-library/midi-library-preview.client";
import { MidiLibraryReuseControls } from "@/features/midi-library/reuse-controls.client";
import { getOptionalViewer } from "@/features/auth/guards";
import {
  formatInstrumentFamily,
  formatPitch,
  MIDI_LIBRARY_RIGHTS_LABELS,
} from "@/features/midi-library/rights";
import type {
  MidiLibraryFilters,
  MidiLibraryRights,
} from "@/features/midi-library/types";
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
      <Container className="py-14 sm:py-20">
        <header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-3xl">
            <p className="text-accent-2 font-mono text-xs tracking-[0.2em] uppercase">
              MIDI library
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              Find a pattern. Hear the{" "}
              <em className="text-accent font-serif font-medium">
                possibility.
              </em>
            </h1>
            <p className="text-muted mt-5 max-w-[52ch] text-lg">
              Explore exact pattern versions, previewed with bundled browser
              synths. Every card says clearly what reuse is—and isn’t—allowed.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {viewer && (
              <ButtonLink href="/library/saved" variant="secondary">
                Saved clips
              </ButtonLink>
            )}
            <ButtonLink href="/library/manage" variant="secondary">
              List your MIDI
            </ButtonLink>
          </div>
        </header>

        {filters && (
          <>
            <nav
              aria-label="Reuse permission"
              className="mt-10 flex flex-wrap gap-2"
            >
              {(["all", "commercial_reuse", "reference_only"] as const).map(
                (rights) => (
                  <Link
                    key={rights}
                    aria-current={
                      filters.rights === rights ? "page" : undefined
                    }
                    className={`min-h-11 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors ${filters.rights === rights ? "border-accent bg-surface-raised text-ink" : "border-strong text-muted hover:border-accent-2 hover:text-ink"}`}
                    href={rightsHref(filters, rights)}
                  >
                    {rights === "all"
                      ? "All"
                      : rights === "commercial_reuse"
                        ? "Commercial reuse permitted"
                        : "Reference only"}
                  </Link>
                ),
              )}
            </nav>
            <form
              action="/library"
              className="rounded-card border-subtle bg-surface mt-5 grid gap-5 border p-5 md:grid-cols-2 xl:grid-cols-4"
            >
              <label className="md:col-span-2 xl:col-span-4">
                <span className="text-accent font-mono text-[11px] tracking-[.16em] uppercase">
                  Search patterns
                </span>
                <input
                  aria-label="Search patterns"
                  name="q"
                  maxLength={80}
                  defaultValue={filters.query ?? ""}
                  placeholder="Pattern, creator, username, or tag"
                  className="rounded-control border-strong bg-surface-soft mt-2 min-h-11 w-full border px-4"
                />
              </label>
              <input type="hidden" name="rights" value={filters.rights} />
              <FilterSelect
                label="Category"
                name="category"
                value={filters.category ?? ""}
                options={options.categories.map((item) => ({
                  value: item.code,
                  label: item.name,
                }))}
              />
              <FilterSelect
                label="Instrument family"
                name="family"
                value={filters.family ?? ""}
                options={families}
              />
              <FilterSelect
                label="Preset"
                name="preset"
                value={filters.preset ?? ""}
                options={options.presets.map((item) => ({
                  value: item.id,
                  label: `${item.name} · ${formatInstrumentFamily(item.family)}`,
                }))}
              />
              <FilterSelect
                label="Tag"
                name="tags"
                value={filters.tags.join(",")}
                options={options.tags.map((item) => ({
                  value: item.code,
                  label: item.name,
                }))}
              />
              <FilterSelect
                label="Duration"
                name="duration"
                value={rangeValue(filters.duration)}
                options={[
                  { value: "0-4", label: "Up to 4 beats" },
                  { value: "4-16", label: "4–16 beats" },
                  { value: "16-64", label: "16–64 beats" },
                  { value: "64-", label: "64+ beats" },
                ]}
              />
              <FilterSelect
                label="Note count"
                name="notes"
                value={rangeValue(filters.notes)}
                options={[
                  { value: "0-16", label: "0–16 notes" },
                  { value: "17-64", label: "17–64 notes" },
                  { value: "65-256", label: "65–256 notes" },
                  { value: "257-", label: "257+ notes" },
                ]}
              />
              <FilterSelect
                label="Pitch range"
                name="pitch"
                value={rangeValue(filters.pitch)}
                options={[
                  { value: "0-47", label: "Low · C-1–B2" },
                  { value: "36-84", label: "Mid · C2–C6" },
                  { value: "60-127", label: "High · C4–G9" },
                ]}
              />
              <FilterSelect
                label="Voicing"
                name="polyphony"
                value={filters.polyphony ?? ""}
                options={[
                  { value: "monophonic", label: "Monophonic" },
                  { value: "polyphonic", label: "Polyphonic" },
                ]}
              />
              <FilterSelect
                label="Sort"
                name="sort"
                value={filters.sort}
                options={[
                  { value: "recent", label: "Recently listed" },
                  { value: "name", label: "Pattern name" },
                ]}
                includeAny={false}
              />
              <div className="flex flex-wrap items-end gap-3 md:col-span-2 xl:col-span-4">
                <button className="cta-gradient text-accent-contrast min-h-11 rounded-full px-6 font-semibold">
                  Explore MIDI
                </button>
                <Link
                  className="text-muted inline-flex min-h-11 items-center px-2 underline"
                  href="/library"
                >
                  Clear filters
                </Link>
              </div>
            </form>
          </>
        )}

        {error ? (
          <MessageState
            title="That search needs another take."
            message={error}
          />
        ) : result?.listings.length ? (
          <section className="mt-12" aria-labelledby="library-results">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-accent font-mono text-[11px] tracking-[.18em] uppercase">
                  Explore set
                </p>
                <h2 id="library-results" className="mt-1 text-2xl font-bold">
                  {result.listings.length} pattern
                  {result.listings.length === 1 ? "" : "s"} in this set
                </h2>
              </div>
              <p className="text-muted text-sm">
                Sorted by {filters?.sort === "name" ? "name" : "recent listing"}
              </p>
            </div>
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {result.listings.map((listing) => (
                <article
                  key={listing.listingId}
                  className="rounded-card border-subtle bg-surface-raised flex flex-col border p-5 shadow-[0_24px_60px_-40px_#000]"
                >
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${listing.reuseMode === "commercial_reuse" ? "border-accent-2 text-accent-2" : "border-strong text-muted"}`}
                    >
                      {MIDI_LIBRARY_RIGHTS_LABELS[listing.reuseMode]}
                    </span>
                    <span className="text-accent font-mono text-[10px] tracking-wider uppercase">
                      {listing.category.name}
                    </span>
                  </div>
                  <h3 className="mt-4 text-2xl font-bold text-balance">
                    <Link
                      className="hover:text-accent underline decoration-transparent hover:decoration-current"
                      href={`/library/${listing.listingId}`}
                    >
                      {listing.title}
                    </Link>
                  </h3>
                  <p className="text-muted mt-2 text-sm">
                    by{" "}
                    <Link
                      className="underline"
                      href={`/@${listing.creatorUsername}`}
                    >
                      @{listing.creatorUsername}
                    </Link>
                  </p>
                  {listing.description && (
                    <p className="text-muted mt-4 line-clamp-3 text-sm">
                      {listing.description}
                    </p>
                  )}
                  <dl className="border-subtle mt-5 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
                    <Metric label="Preset" value={listing.preset.name} />
                    <Metric
                      label="Length"
                      value={`${formatNumber(listing.durationBeats)} beats`}
                    />
                    <Metric label="Notes" value={String(listing.noteCount)} />
                    <Metric
                      label="Pitch / voicing"
                      value={`${formatPitch(listing.minPitch)}–${formatPitch(listing.maxPitch)} · ${listing.polyphony}`}
                    />
                  </dl>
                  <MidiLibraryPreview
                    listingId={listing.listingId}
                    patternVersionId={listing.midiPatternVersionId}
                    title={listing.title}
                    presetId={listing.preset.id}
                    presetVersion={listing.preset.version}
                    durationTicks={listing.durationTicks}
                    notes={listing.notes}
                  />
                  {listing.externalCredits.length > 0 && (
                    <div className="border-subtle mt-4 border-t pt-4">
                      <p className="text-accent font-mono text-[11px] tracking-[.16em] uppercase">
                        External credits
                      </p>
                      {listing.externalCredits
                        .slice(0, 2)
                        .map((credit, index) => (
                          <p
                            key={`${credit.creditedName}-${index}`}
                            className="text-muted mt-2 text-sm"
                          >
                            {credit.role} →{" "}
                            <span className="text-ink">
                              {credit.creditedName}
                            </span>
                          </p>
                        ))}
                      <p className="text-muted mt-2 text-xs">
                        Credit acknowledges a source; it is not proof of
                        permission.
                      </p>
                    </div>
                  )}
                  {listing.reuseMode === "reference_only" && (
                    <p className="border-subtle text-muted mt-4 border-t pt-4 text-sm">
                      Listening and inspection are welcome. Saving, importing,
                      forking, editing, and exporting are not granted.
                    </p>
                  )}
                  {listing.reuseMode === "commercial_reuse" && viewer ? (
                    <MidiLibraryReuseControls
                      listingId={listing.listingId}
                      patternVersionId={listing.midiPatternVersionId}
                      title={listing.title}
                      saved={savedIds.has(listing.midiPatternVersionId)}
                      canReuse
                      workspaces={workspaces}
                      compact
                    />
                  ) : listing.reuseMode === "commercial_reuse" ? (
                    <p className="border-subtle text-muted mt-4 border-t pt-4 text-sm">
                      <Link
                        className="text-accent underline"
                        href={`/sign-in?next=${encodeURIComponent(`/library/${listing.listingId}`)}`}
                      >
                        Sign in
                      </Link>{" "}
                      to save, import, fork, edit, or export this CC BY version.
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
            {nextHref && (
              <div className="mt-10 text-center">
                <Link
                  className="border-strong hover:border-accent-2 inline-flex min-h-11 items-center rounded-full border px-6 font-semibold"
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

function rightsHref(filters: MidiLibraryFilters, rights: MidiLibraryRights) {
  return `/library?${midiLibrarySearchParams({ ...filters, rights, after: null })}`;
}
function rangeValue(range: { min: number | null; max: number | null }) {
  return range.min === null ? "" : `${range.min}-${range.max ?? ""}`;
}
function FilterSelect({
  label,
  name,
  value,
  options,
  includeAny = true,
}: {
  label: string;
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  includeAny?: boolean;
}) {
  return (
    <label>
      <span className="text-accent font-mono text-[11px] tracking-[.16em] uppercase">
        {label}
      </span>
      <select
        className="rounded-control border-strong bg-surface-soft mt-2 min-h-11 w-full border px-3"
        name={name}
        defaultValue={value}
      >
        {includeAny && <option value="">Any</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted font-mono text-[10px] uppercase">{label}</dt>
      <dd className="text-ink mt-1">{value}</dd>
    </div>
  );
}
function MessageState({ title, message }: { title: string; message: string }) {
  return (
    <section className="rounded-card border-subtle mt-10 border border-dashed p-10 text-center">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="text-muted mt-2">{message}</p>
      <Link className="mt-4 inline-flex underline" href="/library">
        Return to all patterns
      </Link>
    </section>
  );
}
function formatNumber(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
