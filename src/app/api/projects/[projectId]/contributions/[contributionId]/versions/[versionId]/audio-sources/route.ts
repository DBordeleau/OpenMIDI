import { NextResponse } from "next/server";
import { z } from "zod";
import { audioSourcesRequestSchema } from "@/features/studio/source-contract";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getContributionVersionPlayback } from "@/server/repositories/contributions";
import { signAudioSourceDescriptors } from "@/server/services/audio-source-delivery";

const paramsSchema = z.object({
  projectId: z.uuid(),
  contributionId: z.uuid(),
  versionId: z.uuid(),
});
const headers = { "Cache-Control": "private, no-store" };
const failure = (status: number, code: string) =>
  NextResponse.json({ error: { code } }, { status, headers });

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      projectId: string;
      contributionId: string;
      versionId: string;
    }>;
  },
) {
  const params = paramsSchema.safeParse(await context.params);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure(400, "invalid_request");
  }
  const parsed = audioSourcesRequestSchema.safeParse(body);
  if (!params.success || !parsed.success)
    return failure(400, "invalid_request");
  const db = await createSupabaseServerClient();
  const { data: claims, error: authError } = await db.auth.getClaims();
  if (authError || !claims?.claims?.sub) return failure(401, "unauthenticated");
  const playback = await getContributionVersionPlayback(params.data);
  if (!playback) return failure(404, "contribution_version_not_found");
  const expected = playback.manifest.tracks
    .map((track) => track.assetId)
    .sort();
  const requested = [...parsed.data.assetIds].sort();
  if (
    requested.length !== expected.length ||
    requested.some((assetId, index) => assetId !== expected[index])
  )
    return failure(409, "asset_set_mismatch");
  const { data: assets, error } = await db
    .from("assets")
    .select(
      "id,bucket,object_path,media_type,duration_ms,sample_rate_hz,channels",
    )
    .in("id", requested)
    .eq("kind", "source_audio")
    .eq("status", "ready")
    .is("deleted_at", null);
  if (
    error ||
    assets.length !== requested.length ||
    assets.some((asset) => asset.bucket !== "source-audio")
  )
    return failure(409, "contribution_audio_unavailable");
  const ordered = expected.map((id) =>
    assets.find((asset) => asset.id === id)!,
  );
  const delivery = await signAudioSourceDescriptors(db, ordered);
  if (delivery.error) return failure(503, "audio_access_unavailable");
  return NextResponse.json({ sources: delivery.sources }, { headers });
}
