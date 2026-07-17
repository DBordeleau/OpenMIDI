import "server-only";

import { z } from "zod";
import type { RevisionSummary } from "@/features/revisions/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const revisionHistorySchema = z.array(
  z.object({
    id: z.string().uuid(),
    revisionNumber: z.number().int().positive(),
    message: z.string().nullable(),
    durationMs: z.number().int().nonnegative(),
    createdAt: z.string(),
    authorName: z.string(),
    publisher: z.object({
      creditName: z.string(),
      profileUsername: z.string().nullable(),
    }),
    acceptedContributor: z
      .object({
        creditName: z.string(),
        profileUsername: z.string().nullable(),
      })
      .nullable(),
    tracks: z.array(
      z.object({
        id: z.string().uuid(),
        kind: z.literal("midi"),
        instrumentName: z.string().nullable(),
        name: z.string(),
        durationMs: z.number().int().nonnegative(),
        sortOrder: z.number().int().nonnegative(),
        creditName: z.string(),
        credits: z.array(
          z.object({
            creditName: z.string(),
            role: z.enum(["creator", "derivation"]),
            position: z.number().int().nonnegative(),
            profileUsername: z.string().nullable(),
          }),
        ),
      }),
    ),
  }),
);

export async function getRevisionHistory(
  projectId: string,
): Promise<RevisionSummary[]> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("get_project_revision_history_v3", {
    p_project_id: projectId,
  });
  if (error) throw new Error("revision_history_unavailable");
  return revisionHistorySchema.parse(data);
}
