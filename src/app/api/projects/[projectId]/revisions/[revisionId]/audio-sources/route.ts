import { NextResponse } from "next/server";
import { z } from "zod";
import { projectIdSchema } from "@/features/projects/schema";
import { audioSourcesRequestSchema } from "@/features/studio/source-contract";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRevisionPlayback } from "@/server/repositories/revisions";
import { signAudioSourceDescriptors } from "@/server/services/audio-source-delivery";

const paramsSchema = z.object({
  projectId: projectIdSchema,
  revisionId: z.uuid(),
});
const headers = { "Cache-Control": "private, no-store" };
const failure = (status: number, code: string) =>
  NextResponse.json({ error: { code } }, { status, headers });

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; revisionId: string }> },
) {
  const parsedParams = paramsSchema.safeParse(await context.params);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure(400, "invalid_request");
  }
  const parsedBody = audioSourcesRequestSchema.safeParse(body);
  if (!parsedParams.success || !parsedBody.success)
    return failure(400, "invalid_request");

  const db = await createSupabaseServerClient();
  const { data: claims, error: authError } = await db.auth.getClaims();
  if (authError || !claims?.claims?.sub) return failure(401, "unauthenticated");
  const { projectId, revisionId } = parsedParams.data;
  const playback = await getRevisionPlayback({ projectId, revisionId });
  if (!playback) return failure(404, "revision_not_found");
  const requested = [...parsedBody.data.assetIds].sort();
  const expected = playback.manifest.tracks
    .map((track) => track.assetId)
    .sort();
  if (
    requested.length !== expected.length ||
    requested.some((id, i) => id !== expected[i])
  )
    return failure(409, "asset_set_mismatch");

  const { data: assets, error: assetError } = await db
    .from("assets")
    .select(
      "id,bucket,object_path,media_type,duration_ms,sample_rate_hz,channels",
    )
    .in("id", requested)
    .eq("kind", "source_audio")
    .eq("status", "ready")
    .is("deleted_at", null);
  if (assetError || assets.length !== requested.length)
    return failure(409, "revision_audio_unavailable");
  const buckets = new Set(assets.map((asset) => asset.bucket));
  if (buckets.size !== 1 || !buckets.has("source-audio"))
    return failure(409, "revision_audio_unavailable");

  const ordered = expected.map((id) =>
    assets.find((asset) => asset.id === id)!,
  );
  const delivery = await signAudioSourceDescriptors(db, ordered);
  if (delivery.error) return failure(503, "audio_access_unavailable");
  return NextResponse.json({ sources: delivery.sources }, { headers });
}
