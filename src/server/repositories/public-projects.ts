import "server-only";

import { unstable_cache } from "next/cache";
import { z } from "zod";
import type {
  PublicProject,
  PublicProjectLineage,
} from "@/features/discovery/types";
import { musicalKeys } from "@/features/projects/schema";
import { createSupabaseAnonymousClient } from "@/lib/supabase/anonymous";
import {
  PUBLIC_PROJECTS_CACHE_TAG,
  publicProjectCacheTag,
} from "@/lib/cache/public-projects";
import {
  getDiscoveryVersion,
  getPublicProfiles,
} from "@/server/repositories/discovery";

const taxonomySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
});
const trackSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["audio", "midi"]).default("audio"),
  name: z.string(),
  durationMs: z.number().int().positive(),
  positionMs: z.number().int().nonnegative(),
  sortOrder: z.number().int().nonnegative(),
  instrument: taxonomySchema.nullable(),
  preset: z
    .object({ id: z.string(), version: z.number().int().positive() })
    .nullable()
    .default(null),
  credits: z.array(
    z.object({
      position: z.number().int().nonnegative(),
      creditName: z.string(),
      role: z.string(),
      profileId: z.string().uuid().nullable(),
    }),
  ),
});
const attributionSchema = z.object({
  kind: z.enum(["publisher", "accepted_contributor"]),
  creditName: z.string(),
  profileId: z.string().uuid(),
});
const lineageSchema = z.object({
  source: z
    .object({
      projectId: z.string().uuid(),
      title: z.string(),
      revisionId: z.string().uuid(),
      revisionNumber: z.number().int().positive(),
    })
    .nullable(),
  sourceUnavailable: z.boolean(),
  directForks: z.array(
    z.object({
      projectId: z.string().uuid(),
      title: z.string(),
      publishedAt: z.string(),
    }),
  ),
  hasMoreDirectForks: z.boolean(),
});

export async function getPublicProject(
  projectId: string,
): Promise<PublicProject | null> {
  const discoveryVersion = await getDiscoveryVersion();
  const load = unstable_cache(
    async (version: number) => {
      void version;
      const db = createSupabaseAnonymousClient();
      return db
        .from("public_project_catalog")
        .select(
          "project_id,owner_id,title,description,bpm,musical_key,time_signature_numerator,time_signature_denominator,license_code,license_name,license_url,license_summary,license_allows_derivatives,open_to_contributions,current_revision_id,revision_number,duration_ms,published_at,updated_at,genres,tags,tracks,attributions,trending_score,discovery_version",
        )
        .eq("project_id", projectId)
        .maybeSingle();
    },
    ["public-project-v1", projectId],
    {
      tags: [PUBLIC_PROJECTS_CACHE_TAG, publicProjectCacheTag(projectId)],
      revalidate: 300,
    },
  );
  const { data: row, error } = await load(discoveryVersion);
  if (error) throw new Error("public_project_unavailable");
  if (!row) return null;
  const genres = z
    .array(taxonomySchema.extend({ isPrimary: z.boolean() }))
    .parse(row.genres);
  const tags = z.array(taxonomySchema).parse(row.tags);
  const tracks = z.array(trackSchema).parse(row.tracks);
  const attributions = z.array(attributionSchema).parse(row.attributions);
  const profileIds = [
    row.owner_id,
    ...tracks.flatMap((track) =>
      track.credits.flatMap((credit) => credit.profileId ?? []),
    ),
    ...attributions.map((attribution) => attribution.profileId),
  ];
  const profiles = await getPublicProfiles(profileIds);
  const owner = profiles.get(row.owner_id);
  if (!owner) return null;
  return {
    projectId: row.project_id,
    ownerId: row.owner_id,
    ownerUsername: owner.username,
    ownerDisplayName: owner.displayName,
    title: row.title,
    description: row.description,
    bpm: row.bpm === null ? null : Number(row.bpm),
    musicalKey: z.enum(musicalKeys).nullable().parse(row.musical_key),
    timeSignature: {
      numerator: row.time_signature_numerator,
      denominator: row.time_signature_denominator,
    },
    license: {
      code: row.license_code,
      name: row.license_name,
      url: row.license_url,
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
}

export async function getPublicProjectLineage(
  projectId: string,
): Promise<PublicProjectLineage> {
  const db = createSupabaseAnonymousClient();
  const { data, error } = await db.rpc("get_public_project_lineage", {
    p_project_id: projectId,
  });
  if (error) throw new Error("public_project_lineage_unavailable");
  return lineageSchema.parse(data);
}
