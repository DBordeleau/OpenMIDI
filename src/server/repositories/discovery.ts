import "server-only";

import { unstable_cache } from "next/cache";
import { z } from "zod";
import {
  decodeDiscoveryCursor,
  encodeDiscoveryCursor,
  filterFingerprint,
} from "@/features/discovery/schema";
import type {
  DiscoveryFilters,
  DiscoveryOptions,
  DiscoveryPage,
  PublicProject,
} from "@/features/discovery/types";
import { musicalKeys } from "@/features/projects/schema";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseAnonymousClient } from "@/lib/supabase/anonymous";
import { PUBLIC_PROJECTS_CACHE_TAG } from "@/lib/cache/public-projects";

const taxonomySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
});
const genresSchema = z.array(taxonomySchema.extend({ isPrimary: z.boolean() }));
const tracksSchema = z.array(
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    durationMs: z.number().int().positive(),
    positionMs: z.number().int().nonnegative(),
    sortOrder: z.number().int().nonnegative(),
    instrument: taxonomySchema.nullable(),
    credits: z.array(
      z.object({
        position: z.number().int().nonnegative(),
        creditName: z.string(),
        role: z.string(),
        profileId: z.string().uuid().nullable(),
      }),
    ),
  }),
);
const attributionsSchema = z.array(
  z.object({
    kind: z.enum(["publisher", "accepted_contributor"]),
    creditName: z.string(),
    profileId: z.string().uuid(),
  }),
);
type SearchRow =
  Database["public"]["Functions"]["search_public_projects"]["Returns"][number];

export async function getDiscoveryVersion() {
  const db = createSupabaseAnonymousClient();
  const { data, error } = await db
    .from("discovery_state")
    .select("version")
    .eq("singleton", true)
    .single();
  if (error) throw new Error("discovery_unavailable");
  return Number(data.version);
}

export async function getPublicProfiles(ids: string[]) {
  if (ids.length === 0)
    return new Map<string, { username: string; displayName: string }>();
  const db = createSupabaseAnonymousClient();
  const { data, error } = await db
    .from("public_profiles")
    .select("id,username,display_name")
    .in("id", [...new Set(ids)]);
  if (error) throw new Error("discovery_profiles_unavailable");
  return new Map(
    data.flatMap((profile) =>
      profile.id && profile.username && profile.display_name
        ? [
            [
              profile.id,
              { username: profile.username, displayName: profile.display_name },
            ] as const,
          ]
        : [],
    ),
  );
}

async function mapSearchRows(rows: SearchRow[]): Promise<PublicProject[]> {
  const parsed = rows.map((row) => ({
    row,
    genres: genresSchema.parse(row.genres),
    tags: z.array(taxonomySchema).parse(row.tags),
    tracks: tracksSchema.parse(row.tracks),
    attributions: attributionsSchema.parse(row.attributions),
  }));
  const profileIds = parsed.flatMap(({ row, tracks, attributions }) => [
    row.owner_id,
    ...tracks.flatMap((track) =>
      track.credits.flatMap((credit) => credit.profileId ?? []),
    ),
    ...attributions.map(({ profileId }) => profileId),
  ]);
  const profiles = await getPublicProfiles(profileIds);
  return parsed.map(({ row, genres, tags, tracks, attributions }) => {
    const owner = profiles.get(row.owner_id);
    if (!owner) throw new Error("discovery_owner_unavailable");
    return {
      projectId: row.project_id,
      ownerId: row.owner_id,
      ownerUsername: owner.username,
      ownerDisplayName: owner.displayName,
      title: row.title,
      description: row.description,
      bpm: row.bpm === null ? null : Number(row.bpm),
      musicalKey: z.enum(musicalKeys).nullable().parse(row.musical_key),
      timeSignature: null,
      license: {
        code: row.license_code,
        name: row.license_name,
        url: null,
        summary: row.license_summary,
        allowsDerivatives: row.license_allows_derivatives,
      },
      openToContributions: row.open_to_contributions,
      currentRevisionId: row.current_revision_id,
      revisionNumber: row.revision_number,
      durationMs: row.duration_ms,
      publishedAt: row.published_at,
      updatedAt: row.updated_at,
      genres,
      tags,
      tracks: tracks.map((track) => ({
        ...track,
        credits: track.credits.map((credit) => ({
          ...credit,
          profileUsername: credit.profileId
            ? (profiles.get(credit.profileId)?.username ?? null)
            : null,
        })),
      })),
      attributions: attributions.map((attribution) => ({
        ...attribution,
        profileUsername: profiles.get(attribution.profileId)?.username ?? null,
      })),
      trendingScore: Number(row.trending_score),
      discoveryVersion: Number(row.discovery_version),
    };
  });
}

const searchCached = unstable_cache(
  async (
    discoveryVersion: number,
    filters: DiscoveryFilters,
    cursor: ReturnType<typeof decodeDiscoveryCursor>,
  ) => {
    void discoveryVersion;
    const db = createSupabaseAnonymousClient();
    const args = {
      p_query: filters.query,
      p_genres: filters.genres,
      p_tags: filters.tags,
      p_instruments: filters.instruments,
      p_keys: filters.keys,
      p_bpm_min: filters.bpmMin,
      p_bpm_max: filters.bpmMax,
      p_open: filters.openOnly ? true : null,
      p_sort: filters.sort,
      p_after_score: cursor?.score ?? null,
      p_after_published_at: cursor?.publishedAt ?? null,
      p_after_project_id: cursor?.projectId ?? null,
      p_limit: 25,
    } as unknown as Database["public"]["Functions"]["search_public_projects"]["Args"];
    const { data, error } = await db.rpc("search_public_projects", args);
    if (error) throw new Error("discovery_unavailable");
    return data;
  },
  ["public-project-search-v1"],
  { tags: [PUBLIC_PROJECTS_CACHE_TAG], revalidate: 300 },
);

export async function searchPublicProjects(
  filters: DiscoveryFilters,
): Promise<DiscoveryPage> {
  const discoveryVersion = await getDiscoveryVersion();
  const filtersWithoutCursor = {
    query: filters.query,
    genres: filters.genres,
    tags: filters.tags,
    instruments: filters.instruments,
    keys: filters.keys,
    bpmMin: filters.bpmMin,
    bpmMax: filters.bpmMax,
    openOnly: filters.openOnly,
    sort: filters.sort,
  };
  const fingerprint = filterFingerprint(filtersWithoutCursor);
  const cursor = filters.after ? decodeDiscoveryCursor(filters.after) : null;
  if (
    filters.after &&
    (!cursor ||
      cursor.sort !== filters.sort ||
      cursor.filterHash !== fingerprint ||
      cursor.discoveryVersion !== discoveryVersion)
  )
    throw new Error("discovery_cursor_stale");
  const rows = await searchCached(discoveryVersion, filters, cursor);
  const visibleRows = rows.slice(0, 24);
  const projects = await mapSearchRows(visibleRows);
  const last = rows.length > 24 ? visibleRows.at(-1) : null;
  return {
    projects,
    discoveryVersion,
    nextCursor: last
      ? encodeDiscoveryCursor({
          version: 1,
          sort: filters.sort,
          filterHash: fingerprint,
          discoveryVersion,
          projectId: last.project_id,
          publishedAt: last.published_at,
          score:
            filters.sort === "trending" ? Number(last.trending_score) : null,
        })
      : null,
  };
}

export async function listDiscoveryOptions(): Promise<DiscoveryOptions> {
  const db = createSupabaseAnonymousClient();
  const [genres, tags, instruments] = await Promise.all([
    db.from("genres").select("id,slug,name").order("sort_order"),
    db.from("tags").select("id,slug,display_name").order("sort_order"),
    db.from("instruments").select("id,slug,name").order("sort_order"),
  ]);
  if (genres.error || tags.error || instruments.error)
    throw new Error("discovery_options_unavailable");
  return {
    genres: genres.data,
    tags: tags.data.map((tag) => ({
      id: tag.id,
      slug: tag.slug,
      name: tag.display_name,
    })),
    instruments: instruments.data,
  };
}
