import Link from "next/link";
import { FiChevronDown, FiSearch } from "react-icons/fi";
import { formatInstrumentFamily } from "./rights";
import { midiLibrarySearchParams } from "./schema";
import type { MidiLibraryFilters, MidiLibraryRights } from "./types";

type Option = { value: string; label: string };

const RIGHTS_TABS: Array<{ value: MidiLibraryRights; label: string }> = [
  { value: "all", label: "All" },
  { value: "commercial_reuse", label: "Reusable" },
  { value: "reference_only", label: "Reference" },
];

function rightsHref(filters: MidiLibraryFilters, rights: MidiLibraryRights) {
  return `/library?${midiLibrarySearchParams({ ...filters, rights, after: null })}`;
}

function rangeValue(range: { min: number | null; max: number | null }) {
  return range.min === null ? "" : `${range.min}-${range.max ?? ""}`;
}

/**
 * Counts the filters hidden inside the disclosure, so the summary can say how
 * many are doing something. Search, rights and sort live in the visible bar and
 * are deliberately excluded.
 */
function advancedCount(filters: MidiLibraryFilters) {
  return [
    filters.category,
    filters.family,
    filters.preset,
    filters.tags.length ? "tags" : null,
    filters.duration.min !== null ? "duration" : null,
    filters.notes.min !== null ? "notes" : null,
    filters.pitch.min !== null ? "pitch" : null,
    filters.polyphony,
  ].filter(Boolean).length;
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
  options: Option[];
  includeAny?: boolean;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-muted font-mono text-[10px] tracking-[0.16em] uppercase">
        {label}
      </span>
      <select
        className="rounded-control border-strong bg-surface-soft focus:border-accent min-h-10 w-full border px-3 text-sm transition-colors"
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

/**
 * One glass toolbar instead of a wall of nine selects. Search, rights and sort
 * stay on the surface; everything else lives behind a disclosure that opens
 * itself when it holds an active filter, so a shared URL never hides why the
 * results look narrow. It is a plain `<details>` inside the GET form, so it
 * needs no client JavaScript.
 */
export function LibraryFilters({
  filters,
  categories,
  families,
  presets,
  tags,
}: {
  filters: MidiLibraryFilters;
  categories: Option[];
  families: Option[];
  presets: Option[];
  tags: Option[];
}) {
  const active = advancedCount(filters);

  return (
    <form
      action="/library"
      className="dash-card rounded-card relative grid gap-2 p-2.5 sm:gap-3 sm:p-4"
    >
      <input type="hidden" name="rights" value={filters.rights} />

      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
        <span className="relative min-w-48 flex-1">
          <FiSearch
            aria-hidden="true"
            className="text-muted pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
          />
          <input
            aria-label="Search patterns"
            name="q"
            maxLength={80}
            defaultValue={filters.query ?? ""}
            placeholder="Pattern, creator, username, or tag"
            className="rounded-control border-strong bg-surface-soft focus:border-accent min-h-11 w-full border pr-4 pl-10 transition-colors"
          />
        </span>
        <label className="flex items-center gap-2">
          <span className="text-muted sr-only sm:not-sr-only sm:font-mono sm:text-[10px] sm:tracking-[0.16em] sm:uppercase">
            Sort
          </span>
          <select
            name="sort"
            defaultValue={filters.sort}
            className="rounded-control border-strong bg-surface-soft focus:border-accent min-h-11 border px-3 text-sm transition-colors"
          >
            <option value="recent">Recently listed</option>
            <option value="name">Pattern name</option>
          </select>
        </label>
        <button className="cta-gradient text-accent-contrast min-h-11 shrink-0 rounded-full px-5 text-sm font-semibold">
          Explore
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <nav
          // No wrap on a phone so the chips and the disclosure share one row;
          // wrapping returns from `sm` up so a narrow window cannot overflow
          // the toolbar.
          aria-label="Reuse permission"
          className="flex shrink-0 gap-1.5 sm:flex-wrap"
        >
          {RIGHTS_TABS.map((tab) => {
            const current = filters.rights === tab.value;
            return (
              <Link
                key={tab.value}
                prefetch={false}
                aria-current={current ? "page" : undefined}
                className={`min-h-9 shrink-0 rounded-full border px-3 text-[13px] font-semibold whitespace-nowrap transition-colors sm:px-3.5 sm:text-sm ${current ? "border-accent bg-accent/12 text-accent" : "border-subtle text-muted hover:border-accent-2 hover:text-ink"} inline-flex items-center`}
                href={rightsHref(filters, tab.value)}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {active > 0 && (
          <Link
            prefetch={false}
            href={`/library?rights=${filters.rights}`}
            className="text-muted hover:text-accent ml-auto text-sm font-semibold transition-colors"
          >
            Clear filters
          </Link>
        )}

        <details
          // Opens itself when it is hiding something, so a shared URL never
          // looks like an unfiltered one.
          open={active > 0}
          className={`group ${active > 0 ? "" : "ml-auto"}`}
        >
          <summary className="border-subtle text-muted hover:border-accent-2 hover:text-ink inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold whitespace-nowrap transition-colors sm:px-3.5 sm:text-sm">
            <span className="sm:hidden">Filters</span>
            <span className="hidden sm:inline">More filters</span>
            {active > 0 && (
              <span className="bg-accent/15 text-accent rounded-full px-1.5 font-mono text-[11px]">
                {active}
              </span>
            )}
            <FiChevronDown
              aria-hidden="true"
              className="transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="border-subtle mt-3 grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect
              label="Category"
              name="category"
              value={filters.category ?? ""}
              options={categories}
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
              options={presets}
            />
            <FilterSelect
              label="Tag"
              name="tags"
              value={filters.tags.join(",")}
              options={tags}
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
          </div>
        </details>
      </div>
    </form>
  );
}

export { formatInstrumentFamily };
