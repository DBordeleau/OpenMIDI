import "server-only";

import { buildStemFilenames } from "@/features/exports/filename";
import type { StemExportResponse } from "@/features/exports/contract";
import type { WorkspaceTrackV1 } from "@/features/studio/manifest/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getProjectForViewer } from "@/server/repositories/projects";
import { getRevisionPlayback } from "@/server/repositories/revisions";
import { getActiveWorkspace } from "@/server/repositories/workspaces";

const SIGNED_URL_SECONDS = 600;

type Authority =
  | { mode: "revision"; projectId: string; revisionId: string }
  | { mode: "workspace"; projectId: string; workspaceId: string };

export async function createStemExport(
  authority: Authority,
  requestedAssetIds: readonly string[],
): Promise<StemExportResponse | null> {
  const project = await getProjectForViewer(authority.projectId);
  if (!project) return null;

  let tracks: WorkspaceTrackV1[];
  let revisionId: string | null = null;
  let revisionNumber: number | null = null;
  let workspaceId: string | null = null;
  if (authority.mode === "revision") {
    const revision = await getRevisionPlayback({
      projectId: authority.projectId,
      revisionId: authority.revisionId,
    });
    if (!revision) return null;
    tracks = revision.manifest.tracks;
    revisionId = revision.revisionId;
    revisionNumber = revision.revisionNumber;
  } else {
    const workspace = await getActiveWorkspace(authority.projectId);
    if (!workspace || workspace.id !== authority.workspaceId) return null;
    tracks = workspace.manifest.tracks;
    workspaceId = workspace.id;
  }
  const expected = tracks.map((track) => track.assetId).sort();
  const requested = [...requestedAssetIds].sort();
  if (
    expected.length !== requested.length ||
    expected.some((assetId, index) => assetId !== requested[index])
  )
    throw new Error("stem_export_asset_set_mismatch");

  const db = await createSupabaseServerClient();
  const { data: assets, error } = await db
    .from("assets")
    .select(
      "id,bucket,object_path,media_type,byte_size,sha256,asset_credits(credit_name,position)",
    )
    .in("id", expected)
    .eq("kind", "source_audio")
    .eq("status", "ready")
    .is("deleted_at", null);
  if (
    error ||
    assets.length !== expected.length ||
    assets.some(
      (asset) =>
        asset.bucket !== "source-audio" ||
        !asset.media_type ||
        !asset.byte_size ||
        !asset.sha256,
    )
  )
    throw new Error("stem_export_unavailable");

  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const ordered = tracks.map((track) => ({
    track,
    asset: assetsById.get(track.assetId)!,
  }));
  const filenames = buildStemFilenames(
    ordered.map(({ track, asset }) => ({
      assetId: asset.id,
      name: track.name,
      mediaType: asset.media_type!,
      sortOrder: track.sortOrder,
    })),
  );
  const signed = await Promise.all(
    ordered.map(({ asset }, index) =>
      db.storage
        .from("source-audio")
        .createSignedUrl(asset.object_path, SIGNED_URL_SECONDS, {
          download: filenames[index],
        }),
    ),
  );
  if (signed.some((result) => result.error || !result.data?.signedUrl))
    throw new Error("stem_export_signing_unavailable");

  const expiresAt = new Date(
    Date.now() + SIGNED_URL_SECONDS * 1000,
  ).toISOString();
  return {
    version: 1,
    projectId: project.id,
    projectTitle: project.title,
    revisionId,
    revisionNumber,
    workspaceId,
    files: ordered.map(({ asset }, index) => ({
      assetId: asset.id,
      filename: filenames[index]!,
      mediaType: asset.media_type!,
      byteSize: Number(asset.byte_size),
      sha256: asset.sha256!,
      creditName:
        asset.asset_credits.find((credit) => credit.position === 0)
          ?.credit_name ?? "Unknown creator",
      signedUrl: signed[index]!.data!.signedUrl,
      expiresAt,
    })),
  };
}
