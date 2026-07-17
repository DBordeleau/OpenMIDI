import { NextResponse } from "next/server";
import { z } from "zod";
import { projectIdSchema } from "@/features/projects/schema";
import { getPublicMidiRevision } from "@/server/repositories/public-midi";

const paramsSchema = z.object({
  projectId: projectIdSchema,
  revisionId: z.uuid(),
});
const headers = { "Cache-Control": "private, no-store" };
const failure = (status: number, code: string) =>
  NextResponse.json({ error: { code } }, { status, headers });

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string; revisionId: string }> },
) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return failure(400, "invalid_request");
  try {
    const revision = await getPublicMidiRevision(params.data);
    return revision
      ? NextResponse.json(revision, { headers })
      : failure(404, "preview_not_found");
  } catch {
    return failure(503, "preview_unavailable");
  }
}
