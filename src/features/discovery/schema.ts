import { z } from "zod";
import { musicalKeys } from "@/features/projects/schema";
import type { DiscoveryCursor, DiscoveryFilters } from "./types";

type RawSearchParams = Record<string, string | string[] | undefined>;
const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(50);
function values(value: string | string[] | undefined) {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}
function uniqueSorted(input: string[]) {
  return [...new Set(input)].sort();
}
function one(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.length === 1 ? value[0] : undefined;
  return value;
}
function hasRepeatedScalar(value: string | string[] | undefined) {
  return Array.isArray(value) && value.length !== 1;
}
function parseBpm(value: string | undefined) {
  if (!value) return null;
  if (!/^\d{1,3}(?:\.\d{1,3})?$/.test(value)) return Number.NaN;
  return Number(value);
}

export function filterFingerprint(filters: Omit<DiscoveryFilters, "after">) {
  const source = JSON.stringify(filters);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function parseDiscoveryFilters(
  params: RawSearchParams,
):
  | { success: true; data: DiscoveryFilters }
  | { success: false; message: string } {
  const queryValue = one(params.q) ?? "";
  const sortValue = one(params.sort) ?? "recent";
  const bpmMin = parseBpm(one(params.bpmMin));
  const bpmMax = parseBpm(one(params.bpmMax));
  const openValue = one(params.open);
  const afterValue = one(params.after);
  const genres = uniqueSorted(values(params.genre));
  const tags = uniqueSorted(values(params.tag));
  const instruments = uniqueSorted(values(params.instrument));
  const keys = uniqueSorted(values(params.key));
  if (
    [
      params.q,
      params.sort,
      params.bpmMin,
      params.bpmMax,
      params.open,
      params.after,
    ].some(hasRepeatedScalar) ||
    queryValue.length > 80 ||
    !["recent", "trending"].includes(sortValue) ||
    genres.length > 3 ||
    tags.length > 10 ||
    instruments.length > 8 ||
    keys.length > 6 ||
    !genres.every((item) => slugSchema.safeParse(item).success) ||
    !tags.every((item) => slugSchema.safeParse(item).success) ||
    !instruments.every((item) => slugSchema.safeParse(item).success) ||
    !keys.every((item) => z.enum(musicalKeys).safeParse(item).success) ||
    Number.isNaN(bpmMin) ||
    Number.isNaN(bpmMax) ||
    (bpmMin !== null && (bpmMin < 20 || bpmMin > 400)) ||
    (bpmMax !== null && (bpmMax < 20 || bpmMax > 400)) ||
    (bpmMin !== null && bpmMax !== null && bpmMin > bpmMax) ||
    (openValue !== undefined && openValue !== "1") ||
    (afterValue !== undefined && afterValue.length > 512)
  )
    return {
      success: false,
      message: "Check the search terms and filters, then try again.",
    };
  return {
    success: true,
    data: {
      query: queryValue.trim() || null,
      genres,
      tags,
      instruments,
      keys: keys as DiscoveryFilters["keys"],
      bpmMin,
      bpmMax,
      openOnly: openValue === "1",
      sort: sortValue as DiscoveryFilters["sort"],
      after: afterValue ?? null,
    },
  };
}

const cursorSchema = z.object({
  version: z.literal(1),
  sort: z.enum(["recent", "trending"]),
  filterHash: z.string().min(1).max(16),
  discoveryVersion: z.number().int().positive(),
  projectId: z.string().uuid(),
  publishedAt: z.iso.datetime({ offset: true }),
  score: z.number().nullable(),
});
export function encodeDiscoveryCursor(cursor: DiscoveryCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}
export function decodeDiscoveryCursor(value: string): DiscoveryCursor | null {
  if (value.length > 512) return null;
  try {
    return cursorSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
  } catch {
    return null;
  }
}
export function discoverySearchParams(filters: DiscoveryFilters) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  for (const value of filters.genres) params.append("genre", value);
  for (const value of filters.tags) params.append("tag", value);
  for (const value of filters.instruments) params.append("instrument", value);
  for (const value of filters.keys) params.append("key", value);
  if (filters.bpmMin !== null) params.set("bpmMin", String(filters.bpmMin));
  if (filters.bpmMax !== null) params.set("bpmMax", String(filters.bpmMax));
  if (filters.openOnly) params.set("open", "1");
  if (filters.sort !== "recent") params.set("sort", filters.sort);
  if (filters.after) params.set("after", filters.after);
  return params;
}
