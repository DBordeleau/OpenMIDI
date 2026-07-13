import "server-only";

import { createSupabaseAnonymousClient } from "@/lib/supabase/anonymous";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileInput } from "@/features/profiles/schema";
import type {
  PublicProfile,
  PublicProfileHistory,
  ViewerProfile,
} from "@/features/profiles/types";
import type { AcceptedContributionHistoryItem } from "@/features/profiles/types";
import { z } from "zod";

const publicProfileHistorySchema = z.object({
  projects: z.array(
    z.object({
      projectId: z.string().uuid(),
      title: z.string(),
      publishedAt: z.string(),
    }),
  ),
  acceptedContributions: z.array(
    z.object({
      projectId: z.string().uuid(),
      projectTitle: z.string(),
      revisionId: z.string().uuid(),
      revisionNumber: z.number().int().positive(),
      acceptedAt: z.string(),
      creditName: z.string(),
    }),
  ),
});

export async function getViewerProfile(): Promise<ViewerProfile | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_viewer_profile");
  if (error) {
    if (error.code === "PT401") return null;
    throw new Error(`viewer_profile_${error.code}`);
  }
  const row = data[0];
  if (!row) throw new Error("viewer_profile_missing");
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    creditName: row.credit_name,
    bio: row.bio,
    status: row.status,
    profileCompletedAt: row.profile_completed_at,
  };
}

export async function listViewerAcceptedContributions(
  userId: string,
): Promise<AcceptedContributionHistoryItem[]> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("revision_attributions")
    .select(
      "revision_id,credit_name,created_at,project_revisions!inner(revision_number,projects!project_revisions_project_id_fkey!inner(id,title))",
    )
    .eq("kind", "accepted_contributor")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error("accepted_contributions_unavailable");
  return data.map((row) => ({
    revisionId: row.revision_id,
    revisionNumber: row.project_revisions.revision_number,
    projectId: row.project_revisions.projects.id,
    projectTitle: row.project_revisions.projects.title,
    acceptedAt: row.created_at,
    creditName: row.credit_name,
  }));
}

export async function saveViewerProfile(input: ProfileInput) {
  const supabase = await createSupabaseServerClient();
  return supabase.rpc("save_own_profile", {
    p_username: input.username,
    p_display_name: input.displayName,
    p_credit_name: input.creditName,
    p_bio: input.bio ?? undefined,
  });
}

export async function getPublicProfile(
  handle: string,
): Promise<PublicProfile | null> {
  const supabase = createSupabaseAnonymousClient();
  const { data, error } = await supabase
    .from("public_profiles")
    .select("id, username, display_name, credit_name, bio")
    .eq("username_normalized", handle.toLowerCase())
    .maybeSingle();
  if (
    error ||
    !data ||
    !data.id ||
    !data.username ||
    !data.display_name ||
    !data.credit_name
  )
    return null;
  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    creditName: data.credit_name,
    bio: data.bio,
  };
}

export async function getPublicProfileHistory(
  profileId: string,
): Promise<PublicProfileHistory> {
  const supabase = createSupabaseAnonymousClient();
  const { data, error } = await supabase.rpc("get_public_profile_history", {
    p_profile_id: profileId,
  });
  if (error) throw new Error("public_profile_history_unavailable");
  return publicProfileHistorySchema.parse(data);
}
