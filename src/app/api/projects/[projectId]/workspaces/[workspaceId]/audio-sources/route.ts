import { NextResponse } from "next/server";
import { z } from "zod";
import { projectIdSchema } from "@/features/projects/schema";
import { workspaceAudioSourcesRequestSchema } from "@/features/studio/source-contract";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/server/repositories/workspaces";
import { signAudioSourceDescriptors } from "@/server/services/audio-source-delivery";

const paramsSchema = z.object({
  projectId: projectIdSchema,
  workspaceId: z.uuid(),
});
const headers = { "Cache-Control": "private, no-store" };
const failure = (status: number, code: string) =>
  NextResponse.json({ error: { code } }, { status, headers });

export async function POST(
  request: Request,
  context: {
    params: Promise<{ projectId: string; workspaceId: string }>;
  },
) {
  const params = paramsSchema.safeParse(await context.params);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure(400, "invalid_request");
  }
  const parsed = workspaceAudioSourcesRequestSchema.safeParse(body);
  if (!params.success || !parsed.success)
    return failure(400, "invalid_request");

  const db = await createSupabaseServerClient();
  const { data: claims, error: authError } = await db.auth.getClaims();
  const viewerId = claims?.claims?.sub;
  if (authError || !viewerId) return failure(401, "unauthenticated");
  const workspace = await getActiveWorkspace(params.data.projectId);
  if (!workspace || workspace.id !== params.data.workspaceId)
    return failure(404, "workspace_not_found");

  const requested =
    parsed.data.mode === "load" ? parsed.data.assetIds : [parsed.data.assetId];
  if (parsed.data.mode === "load") {
    const expected = workspace.manifest.tracks.map((track) => track.assetId);
    const left = [...requested].sort();
    const right = [...expected].sort();
    if (
      left.length !== right.length ||
      left.some((assetId, index) => assetId !== right[index])
    )
      return failure(409, "workspace_asset_set_mismatch");
  } else {
    const assetId = parsed.data.assetId;
    if (
      workspace.manifest.tracks.length >= 12 ||
      workspace.manifest.tracks.some((track) => track.assetId === assetId)
    )
      return failure(409, "asset_not_addable");
  }

  const { data: assets, error: assetError } = await db
    .from("assets")
    .select(
      "id,owner_id,bucket,object_path,media_type,duration_ms,sample_rate_hz,channels",
    )
    .in("id", requested)
    .eq("kind", "source_audio")
    .eq("status", "ready")
    .is("deleted_at", null);
  if (
    assetError ||
    assets.length !== requested.length ||
    (parsed.data.mode === "add" && assets[0]?.owner_id !== viewerId) ||
    assets.some((asset) => asset.bucket !== "source-audio")
  )
    return failure(
      409,
      parsed.data.mode === "add"
        ? "asset_not_addable"
        : "workspace_audio_unavailable",
    );

  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const ordered = requested.map((id) => byId.get(id)!);
  const delivery = await signAudioSourceDescriptors(db, ordered);
  if (delivery.error) return failure(503, "audio_access_unavailable");
  return NextResponse.json({ sources: delivery.sources }, { headers });
}
