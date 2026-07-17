import { NextResponse } from "next/server";
import { z } from "zod";
import { createLicensedMidiExport } from "@/features/public-midi/licensed-export";
import { projectIdSchema } from "@/features/projects/schema";
import { getPublicMidiRevision } from "@/server/repositories/public-midi";

const paramsSchema = z.object({
  projectId: projectIdSchema,
  revisionId: z.uuid(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; revisionId: string }> },
) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json(
      { error: { code: "invalid_request" } },
      { status: 400 },
    );
  }
  try {
    const revision = await getPublicMidiRevision(params.data);
    if (!revision) {
      return NextResponse.json(
        { error: { code: "revision_not_found" } },
        { status: 404 },
      );
    }
    if (revision.license.code !== "cc-by-4.0") {
      return NextResponse.json(
        { error: { code: "midi_export_not_licensed" } },
        { status: 403 },
      );
    }
    const exported = createLicensedMidiExport(revision);
    return new NextResponse(new Blob([exported.bytes]), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${exported.filename}"`,
        "Content-Type": "application/zip",
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: "midi_export_unavailable" } },
      { status: 503 },
    );
  }
}
