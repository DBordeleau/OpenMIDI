import { NextResponse } from "next/server";
import { z } from "zod";
import { stemExportRequestSchema } from "@/features/exports/contract";
import { projectIdSchema } from "@/features/projects/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createStemExport } from "@/server/services/stem-exports";

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
  const params = paramsSchema.safeParse(await context.params);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure(400, "invalid_request");
  }
  const parsed = stemExportRequestSchema.safeParse(body);
  if (!params.success || !parsed.success)
    return failure(400, "invalid_request");
  const db = await createSupabaseServerClient();
  const { data: claims, error } = await db.auth.getClaims();
  if (error || !claims?.claims?.sub) return failure(401, "unauthenticated");
  try {
    const result = await createStemExport(
      { mode: "revision", ...params.data },
      parsed.data.assetIds,
    );
    return result
      ? NextResponse.json(result, { headers })
      : failure(404, "revision_not_found");
  } catch (error) {
    return failure(
      error instanceof Error &&
        error.message === "stem_export_asset_set_mismatch"
        ? 409
        : 503,
      error instanceof Error ? error.message : "stem_export_unavailable",
    );
  }
}
