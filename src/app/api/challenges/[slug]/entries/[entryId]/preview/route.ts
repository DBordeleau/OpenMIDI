import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicChallengeEntryPreview } from "@/server/repositories/challenges";

const paramsSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  entryId: z.uuid(),
});
const headers = { "Cache-Control": "private, no-store" };
const failure = (status: number, code: string) =>
  NextResponse.json({ error: { code } }, { status, headers });

export async function POST(
  _request: Request,
  context: { params: Promise<{ slug: string; entryId: string }> },
) {
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) return failure(400, "invalid_request");
  try {
    const preview = await getPublicChallengeEntryPreview(
      parsed.data.slug,
      parsed.data.entryId,
    );
    return preview
      ? NextResponse.json(preview, { headers })
      : failure(404, "preview_not_found");
  } catch {
    return failure(503, "preview_unavailable");
  }
}
