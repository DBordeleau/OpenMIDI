import "server-only";

import type { RevisionSummary } from "@/features/revisions/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getRevisionHistory(
  projectId: string,
): Promise<RevisionSummary[]> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("project_revisions")
    .select(
      "id,revision_number,message,duration_ms,created_at,revision_attributions(kind,credit_name,profiles!revision_attributions_user_id_fkey(username)),revision_tracks(id,kind,name,duration_ms,sort_order,preset_id,preset_version,instruments(name),revision_midi_track_credits(creator_credit_name,credit_role,profiles!revision_midi_track_credits_creator_id_fkey(username)))",
    )
    .eq("project_id", projectId)
    .order("revision_number", { ascending: false })
    .limit(20);
  if (error) throw new Error("revision_history_unavailable");
  return data.map((row) => {
    const publisher = row.revision_attributions.find(
      ({ kind }) => kind === "publisher",
    );
    const acceptedContributor = row.revision_attributions.find(
      ({ kind }) => kind === "accepted_contributor",
    );
    if (!publisher) throw new Error("revision_attribution_missing");
    return {
      id: row.id,
      revisionNumber: row.revision_number,
      message: row.message,
      durationMs: row.duration_ms,
      createdAt: row.created_at,
      authorName: publisher.credit_name,
      publisher: {
        creditName: publisher.credit_name,
        profileUsername: publisher.profiles?.username ?? null,
      },
      acceptedContributor: acceptedContributor
        ? {
            creditName: acceptedContributor.credit_name,
            profileUsername: acceptedContributor.profiles?.username ?? null,
          }
        : null,
      tracks: row.revision_tracks
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((track) => {
          if (track.kind !== "midi")
            throw new Error("revision_track_kind_invalid");
          const credits = track.revision_midi_track_credits.map(
            (credit, position) => ({
              creditName: credit.creator_credit_name,
              role:
                credit.credit_role === "derivation_source"
                  ? ("derivation" as const)
                  : ("creator" as const),
              position,
              profileUsername: credit.profiles?.username ?? null,
            }),
          );
          if (!credits[0]) throw new Error("revision_credit_missing");
          return {
            id: track.id,
            kind: "midi" as const,
            instrumentName: track.instruments?.name ?? null,
            name: track.name,
            durationMs: track.duration_ms,
            sortOrder: track.sort_order,
            creditName: credits[0].creditName,
            credits,
          };
        }),
    };
  });
}
