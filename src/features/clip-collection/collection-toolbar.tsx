import Link from "next/link";
import { clipCollectionHref, type ClipCollectionSource } from "./search";

export function ClipCollectionToolbar({
  source,
  query,
}: {
  source: ClipCollectionSource;
  query: string | null;
}) {
  return (
    <div className="dash-card rounded-card p-2">
      <div className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <nav
          aria-label="Clip collection sources"
          className="border-subtle bg-surface-soft/65 grid w-full grid-cols-2 rounded-full border p-1 sm:flex sm:w-auto"
        >
          {(
            [
              ["owned", "My clips"],
              ["saved", "Saved clips"],
            ] as const
          ).map(([value, label]) => (
            <Link
              key={value}
              href={clipCollectionHref(value, query)}
              prefetch={false}
              aria-current={source === value ? "page" : undefined}
              className={`inline-flex min-h-10 items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors motion-reduce:transition-none ${
                source === value
                  ? "bg-ink/10 text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <span
          aria-hidden
          className="border-subtle hidden h-7 border-l sm:block"
        />

        <form
          role="search"
          action="/library/collection"
          className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:w-auto"
        >
          <input type="hidden" name="source" value={source} />
          <label className="sr-only" htmlFor="collection-query">
            Search {source === "owned" ? "My clips" : "Saved clips"}
          </label>
          <input
            id="collection-query"
            name="q"
            type="search"
            maxLength={80}
            defaultValue={query ?? ""}
            placeholder="Title or creator"
            className="rounded-control border-strong bg-canvas/75 min-h-10 w-full min-w-0 border px-3 text-sm sm:w-64"
          />
          <button
            type="submit"
            className="border-strong hover:border-accent hover:text-accent min-h-10 shrink-0 rounded-full border px-3 text-sm font-semibold transition-colors sm:px-4"
          >
            Search
          </button>
          {query && (
            <Link
              href={clipCollectionHref(source, null)}
              prefetch={false}
              className="text-muted hover:text-accent col-span-2 inline-flex min-h-8 items-center justify-center px-2 text-sm font-semibold sm:col-span-1 sm:min-h-10"
            >
              Clear
            </Link>
          )}
        </form>
      </div>
    </div>
  );
}
