import { z } from "zod";

export type ClipCollectionSource = "owned" | "saved";

type SearchParams = Record<string, string | string[] | undefined>;

const sourceSchema = z.enum(["owned", "saved"]);
const querySchema = z.string().trim().max(80);

export function parseClipCollectionSearch(params: SearchParams): {
  source: ClipCollectionSource;
  query: string | null;
  error: string | null;
} {
  const source = sourceSchema.safeParse(params.source);
  const query = querySchema.safeParse(params.q ?? "");

  return {
    source: source.success ? source.data : "owned",
    query: query.success && query.data ? query.data : null,
    error: query.success
      ? null
      : "Search phrases must be 80 characters or fewer.",
  };
}

export function clipCollectionHref(
  source: ClipCollectionSource,
  query: string | null,
) {
  const params = new URLSearchParams({ source });
  if (query) params.set("q", query);
  return `/library/collection?${params}`;
}
