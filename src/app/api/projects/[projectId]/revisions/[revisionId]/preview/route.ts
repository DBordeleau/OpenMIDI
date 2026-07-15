import { NextResponse } from "next/server";
import { z } from "zod";
import { projectIdSchema } from "@/features/projects/schema";
import { parseAnyWorkspaceManifest } from "@/features/studio/manifest/schema";
import { parseMidiStemVersion } from "@/features/studio/manifest/v2";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  projectId: projectIdSchema,
  revisionId: z.string().uuid(),
});
const authoritySchema = z.object({
  projectId: z.string().uuid(),
  revisionId: z.string().uuid(),
  durationMs: z.number().int().positive(),
  manifest: z.unknown(),
  sources: z.array(
    z.object({
      assetId: z.string().uuid(),
      bucket: z.string(),
      objectPath: z.string(),
    }),
  ),
  stems: z.array(z.unknown()).default([]),
});
const headers = { "Cache-Control": "private, no-store" };
const failure = (status: number, code: string) =>
  NextResponse.json({ error: { code } }, { status, headers });

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string; revisionId: string }> },
) {
  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) return failure(400, "invalid_request");
  const { projectId, revisionId } = parsedParams.data;
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("get_project_revision_preview", {
    p_project_id: projectId,
    p_revision_id: revisionId,
  });
  if (error)
    return failure(
      error.code === "PT404" ? 404 : error.code === "PT409" ? 409 : 503,
      error.code === "PT404"
        ? "preview_not_found"
        : error.code === "PT409"
          ? "preview_audio_unavailable"
          : "preview_unavailable",
    );
  const authority = authoritySchema.safeParse(data);
  if (
    !authority.success ||
    authority.data.projectId !== projectId ||
    authority.data.revisionId !== revisionId
  )
    return failure(409, "preview_invalid_state");
  let manifest;
  try {
    manifest = parseAnyWorkspaceManifest(authority.data.manifest);
  } catch {
    return failure(409, "preview_invalid_state");
  }
  const sourceByAsset = new Map(
    authority.data.sources.map((source) => [source.assetId, source]),
  );
  if (manifest.manifestVersion === 2) {
    if (manifest.projectId !== projectId)
      return failure(409, "preview_invalid_state");
    const stemIds = new Set(
      manifest.tracks.flatMap((track) =>
        track.kind === "midi"
          ? track.clips.map((clip) => clip.midiStemVersionId)
          : [],
      ),
    );
    const stems = authority.data.stems.map((stem) => {
      try {
        return parseMidiStemVersion(stem);
      } catch {
        return null;
      }
    });
    const audioAssetIds = [
      ...new Set(
        manifest.tracks.flatMap((track) =>
          track.kind === "audio" ? [track.assetId] : [],
        ),
      ),
    ];
    if (
      sourceByAsset.size !== audioAssetIds.length ||
      audioAssetIds.some((assetId) => !sourceByAsset.has(assetId)) ||
      authority.data.sources.some(
        (source) => source.bucket !== "source-audio",
      ) ||
      stems.some((stem) => stem === null) ||
      stems.length !== stemIds.size ||
      stems.some((stem) => stem && !stemIds.has(stem.stemVersionId))
    )
      return failure(409, "preview_invalid_state");
    const orderedAudio = audioAssetIds.map((assetId) =>
      sourceByAsset.get(assetId)!,
    );
    const { data: signedAudio, error: audioSignError } = orderedAudio.length
      ? await db.storage.from("source-audio").createSignedUrls(
          orderedAudio.map((source) => source.objectPath),
          600,
        )
      : { data: [], error: null };
    if (
      audioSignError ||
      signedAudio.length !== orderedAudio.length ||
      signedAudio.some((item) => item.error || !item.signedUrl)
    )
      return failure(503, "preview_audio_unavailable");
    return NextResponse.json(
      {
        projectId,
        revisionId,
        durationMs: authority.data.durationMs,
        kind: "midi",
        manifest,
        stems,
        audioSources: orderedAudio.map((source, index) => ({
          assetId: source.assetId,
          signedUrl: signedAudio[index]!.signedUrl,
        })),
      },
      { headers },
    );
  }
  if (
    manifest.workspaceId !== projectId ||
    sourceByAsset.size !== manifest.tracks.length ||
    manifest.tracks.some((track) => !sourceByAsset.has(track.assetId)) ||
    authority.data.sources.some((source) => source.bucket !== "source-audio")
  )
    return failure(409, "preview_invalid_state");
  const ordered = manifest.tracks.map((track) =>
    sourceByAsset.get(track.assetId)!,
  );
  const { data: signed, error: signError } = await db.storage
    .from("source-audio")
    .createSignedUrls(
      ordered.map((source) => source.objectPath),
      600,
    );
  if (
    signError ||
    signed.length !== ordered.length ||
    signed.some((item) => item.error || !item.signedUrl)
  )
    return failure(503, "preview_audio_unavailable");
  return NextResponse.json(
    {
      projectId,
      revisionId,
      durationMs: authority.data.durationMs,
      kind: "audio",
      tracks: manifest.tracks.map((track, index) => ({
        trackId: track.trackId,
        signedUrl: signed[index]!.signedUrl,
        positionMs: track.positionMs,
        trimStartMs: track.trimStartMs,
        durationMs: track.durationMs,
        gainDb: track.gainDb,
        pan: track.pan,
        muted: track.muted,
        soloed: track.soloed,
      })),
    },
    { headers },
  );
}
