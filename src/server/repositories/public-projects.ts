import "server-only";

import { unstable_cache } from "next/cache";
import { z } from "zod";
import type {
  PublicProject,
  PublicProjectLineage,
} from "@/features/discovery/types";
import type { ArrangementMapTrack } from "@/features/projects/arrangement-map";
import {
  INSTRUMENT_FAMILIES,
  resolveSynthPreset,
  type InstrumentFamily,
} from "@/features/midi/presets";
import { musicalKeys } from "@/features/projects/schema";
import { createSupabaseAnonymousClient } from "@/lib/supabase/anonymous";
import {
  PUBLIC_PROJECTS_CACHE_TAG,
  publicProjectCacheTag,
} from "@/lib/cache/public-projects";
import { getDiscoveryVersion } from "@/server/repositories/discovery";
import { getPublicProjectProfiles } from "@/server/repositories/public-project-profiles";
import {
  getPublicArrangementCards,
  getPublicProjectSilhouettes,
  type PublicProjectSilhouetteMap,
} from "@/server/repositories/public-midi";

const taxonomySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
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

/**
 * The project page's own view of a public project: the catalog row plus the two
 * things only the detail page draws — clip placement for the arrangement map and
 * the silhouettes that fill those clips.
 *
 * Deliberately *not* folded into `PublicProject`. Discovery search returns up to
 * a page of projects at a time, and clip arrays on every card would multiply the
 * search payload for data no card renders.
 */
export type PublicProjectDetail = Omit<PublicProject, "attributions"> & {
  ownerAvatarConfig: unknown;
  attributions: Array<
    PublicProject["attributions"][number] & { avatarConfig: unknown }
  >;
  patternSilhouettes: PublicProjectSilhouetteMap;
  arrangementTracks: ArrangementMapTrack[];
};

export async function getPublicProject(
  projectId: string,
): Promise<PublicProjectDetail | null> {
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
  const attributions = z.array(attributionSchema).parse(row.attributions);
  const profileIds = [
    row.owner_id,
    ...attributions.map((attribution) => attribution.profileId),
  ];
  const [profiles, arrangements, patternSilhouettes] = await Promise.all([
    getPublicProjectProfiles(profileIds),
    getPublicArrangementCards([
      { projectId: row.project_id, revisionId: row.current_revision_id },
    ]),
    getPublicProjectSilhouettes(row.project_id, row.current_revision_id),
  ]);
  const owner = profiles.get(row.owner_id);
  const arrangement = arrangements.get(row.current_revision_id);
  if (!owner || !arrangement) return null;
  return {
    projectId: row.project_id,
    ownerId: row.owner_id,
    ownerUsername: owner.username,
    ownerDisplayName: owner.displayName,
    ownerAvatarConfig: owner.avatarConfig,
    title: row.title,
    description: row.description,
    bpm: arrangement.manifest.tempoBpm,
    musicalKey: z
      .enum(musicalKeys)
      .nullable()
      .parse(arrangement.manifest.musicalKey),
    timeSignature: arrangement.manifest.timeSignature,
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
    durationMs: arrangement.durationMs,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    genres,
    tags,
    tracks: arrangement.tracks,
    // Straight off the manifest this function already loaded — no extra read.
    arrangementTracks: arrangement.manifest.tracks
      .map((track) => ({
        id: track.trackId,
        name: track.name,
        sortOrder: track.sortOrder,
        ...presentTrackPreset(track.presetId, track.presetVersion),
        clips: track.clips.map((clip) => ({
          clipId: clip.clipId,
          midiPatternVersionId: clip.midiPatternVersionId,
          startTick: clip.startTick,
          durationTicks: clip.durationTicks,
          loop: clip.loop,
        })),
      }))
      .sort((left, right) => left.sortOrder - right.sortOrder),
    attributions: attributions.map((attribution) => ({
      ...attribution,
      profileUsername: profiles.get(attribution.profileId)?.username ?? null,
      avatarConfig: profiles.get(attribution.profileId)?.avatarConfig ?? null,
    })),
    patternSilhouettes,
    trendingScore: Number(row.trending_score),
    discoveryVersion: Number(row.discovery_version),
  };
}

/**
 * A public project may hold any historical manifest, including presets from the
 * legacy catalog whose `family` predates the six instrument families. Resolution
 * never throws here: an unknown preset costs the map one hue, not the page.
 */
function presentTrackPreset(
  presetId: string,
  presetVersion: number,
): { presetName: string; family: InstrumentFamily } {
  let preset: { name: string; family: string } | null = null;
  try {
    preset = resolveSynthPreset(presetId, presetVersion);
  } catch {
    preset = null;
  }
  const family = preset?.family;
  return {
    presetName: preset?.name ?? "Unknown preset",
    family: (INSTRUMENT_FAMILIES as readonly string[]).includes(family ?? "")
      ? (family as InstrumentFamily)
      : family === "drums"
        ? "drums-percussion"
        : "keys",
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
