import Link from "next/link";
import { FiChevronDown, FiSearch, FiSliders } from "react-icons/fi";
import { formatMusicalKey } from "@/features/projects/musical-key";
import { musicalKeys } from "@/features/projects/schema";
import type {
  DiscoveryFilters,
  DiscoveryOptions,
} from "@/features/discovery/types";

function advancedFilterCount(filters: DiscoveryFilters) {
  return [
    filters.genres.length ? "genres" : null,
    filters.tags.length ? "tags" : null,
    filters.instruments.length ? "instruments" : null,
    filters.keys.length ? "keys" : null,
    filters.bpmMin !== null || filters.bpmMax !== null ? "tempo" : null,
    filters.openOnly ? "open" : null,
  ].filter(Boolean).length;
}

function FilterChipGroup({
  legend,
  name,
  options,
  selected,
}: {
  legend: string;
  name: string;
  options: DiscoveryOptions["genres"];
  selected: string[];
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-accent font-mono text-[10px] tracking-[0.16em] uppercase">
        {legend}
      </legend>
      <div className="mt-2 flex [scrollbar-width:none] gap-1.5 overflow-x-auto pb-1 sm:max-h-28 sm:flex-wrap sm:overflow-y-auto">
        {options.map((option) => (
          <label className="shrink-0" key={option.id}>
            <input
              className="peer sr-only"
              type="checkbox"
              name={name}
              value={option.slug}
              defaultChecked={selected.includes(option.slug)}
            />
            <span className="border-subtle text-muted hover:border-accent-2 hover:text-ink peer-checked:border-accent peer-checked:bg-accent/12 peer-checked:text-accent peer-focus-visible:outline-focus inline-flex min-h-11 items-center rounded-full border px-3 text-[13px] font-semibold whitespace-nowrap transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 sm:min-h-9">
              {option.name}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Public discovery keeps its highest-frequency controls visible and moves the
 * taxonomy wall into one progressive disclosure. Active filters open the
 * disclosure on first render so a shared URL always explains its result set.
 */
export function DiscoveryFilters({
  filters,
  options,
}: {
  filters: DiscoveryFilters;
  options: DiscoveryOptions;
}) {
  const active = advancedFilterCount(filters);
  const hasActiveSearch =
    Boolean(filters.query) || filters.sort !== "recent" || active > 0;

  return (
    <form
      action="/explore"
      className="dash-card rounded-card relative grid gap-2.5 overflow-x-clip p-2.5 sm:gap-3 sm:p-4"
    >
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-2.5">
        <span className="relative min-w-0">
          <FiSearch
            aria-hidden="true"
            className="text-muted pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
          />
          <input
            aria-label="Search projects"
            className="rounded-control border-strong bg-surface-soft focus:border-accent min-h-11 w-full border pr-4 pl-10 transition-colors"
            name="q"
            defaultValue={filters.query ?? ""}
            maxLength={80}
            placeholder="Title, description, or tag"
          />
        </span>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <label className="flex min-w-0 items-center gap-2">
            <span className="text-muted sr-only lg:not-sr-only lg:font-mono lg:text-[10px] lg:tracking-[0.16em] lg:uppercase">
              Sort
            </span>
            <select
              className="rounded-control border-strong bg-surface-soft focus:border-accent min-h-11 min-w-0 border px-3 text-sm transition-colors"
              name="sort"
              defaultValue={filters.sort}
              aria-label="Sort projects"
            >
              <option value="recent">Most recent</option>
              <option value="trending">Trending</option>
            </select>
          </label>
          <button className="cta-gradient text-accent-contrast min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold sm:px-5">
            Find projects
          </button>
        </div>
      </div>

      <div className="flex items-start gap-2">
        <details open={active > 0} className="group min-w-0 flex-1">
          <summary className="border-subtle text-muted hover:border-accent-2 hover:text-ink inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border px-3 text-[13px] font-semibold whitespace-nowrap transition-colors sm:min-h-9 sm:px-3.5 sm:text-sm">
            <FiSliders aria-hidden="true" />
            <span className="sm:hidden">Filters</span>
            <span className="hidden sm:inline">Shape the sound</span>
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

          <div className="border-subtle mt-3 grid gap-4 border-t pt-4 sm:grid-cols-2 xl:grid-cols-[1fr_1.2fr_1.2fr_0.9fr]">
            <FilterChipGroup
              legend="Genres"
              name="genre"
              selected={filters.genres}
              options={options.genres}
            />
            <FilterChipGroup
              legend="Tags"
              name="tag"
              selected={filters.tags}
              options={options.tags}
            />
            <FilterChipGroup
              legend="Instruments"
              name="instrument"
              selected={filters.instruments}
              options={options.instruments}
            />
            <fieldset className="min-w-0">
              <legend className="text-accent font-mono text-[10px] tracking-[0.16em] uppercase">
                Musical details
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <select
                  className="rounded-control border-strong bg-surface-soft focus:border-accent col-span-2 min-h-10 min-w-0 border px-3 text-sm transition-colors"
                  name="key"
                  defaultValue={filters.keys[0] ?? ""}
                  aria-label="Musical key"
                >
                  <option value="">Any key</option>
                  {musicalKeys.map((key) => (
                    <option key={key} value={key}>
                      {formatMusicalKey(key)}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-control border-strong bg-surface-soft focus:border-accent min-h-10 min-w-0 border px-3 text-sm transition-colors"
                  name="bpmMin"
                  inputMode="decimal"
                  defaultValue={filters.bpmMin ?? ""}
                  placeholder="Min BPM"
                  aria-label="Minimum BPM"
                />
                <input
                  className="rounded-control border-strong bg-surface-soft focus:border-accent min-h-10 min-w-0 border px-3 text-sm transition-colors"
                  name="bpmMax"
                  inputMode="decimal"
                  defaultValue={filters.bpmMax ?? ""}
                  placeholder="Max BPM"
                  aria-label="Maximum BPM"
                />
              </div>
              <label className="mt-2 inline-flex shrink-0">
                <input
                  className="peer sr-only"
                  type="checkbox"
                  name="open"
                  value="1"
                  defaultChecked={filters.openOnly}
                />
                <span className="border-subtle text-muted hover:border-accent-2 hover:text-ink peer-checked:border-accent-2 peer-checked:bg-accent-2/10 peer-checked:text-accent-2 peer-focus-visible:outline-focus inline-flex min-h-11 items-center rounded-full border px-3 text-[13px] font-semibold whitespace-nowrap transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 sm:min-h-9">
                  Open to contributions
                </span>
              </label>
            </fieldset>
          </div>
        </details>
        {hasActiveSearch && (
          <Link
            className="text-muted hover:text-accent ml-auto inline-flex min-h-11 shrink-0 items-center text-sm font-semibold transition-colors sm:min-h-9"
            href="/explore"
          >
            Clear all
          </Link>
        )}
      </div>
    </form>
  );
}
