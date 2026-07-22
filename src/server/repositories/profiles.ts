import "server-only";

import { createSupabaseAnonymousClient } from "@/lib/supabase/anonymous";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileInput } from "@/features/profiles/schema";
import type {
  AcceptedContributionHistoryItem,
  PublicProfile,
  PublicProfilePage,
  ViewerProfile,
} from "@/features/profiles/types";
import {
  decodeNavigationCursor,
  encodeNavigationCursor,
} from "@/features/navigation/cursor";
import { getDiscoveryVersion } from "@/server/repositories/discovery";
import { z } from "zod";
import {
  publicProfileAwardSchema,
  type PublicProfileAward,
} from "@/features/awards/contract";
import {
  parseAvatarConfig,
  type AvatarResetInput,
  type AvatarSaveInput,
} from "@/features/profiles/avatar/contract";

const publicProjectSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string(),
  publishedAt: z.string(),
});
const acceptedContributionSchema = z.object({
  projectId: z.string().uuid(),
  projectTitle: z.string(),
  revisionId: z.string().uuid(),
  revisionNumber: z.number().int().positive(),
  acceptedAt: z.string(),
  creditName: z.string(),
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
    avatarConfig: parseAvatarConfig(row.avatar_config),
    avatarConfigRevision: row.avatar_config_revision,
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

export async function saveViewerAvatarConfig(input: AvatarSaveInput) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("save_own_avatar_config", {
    p_options: input.options,
    p_expected_revision: input.expectedRevision,
  });
  if (error) return { data: null, error };
  const row = data[0];
  const avatarConfig = parseAvatarConfig(row?.avatar_config);
  if (!row || !avatarConfig) throw new Error("avatar_config_response_invalid");
  return {
    data: {
      avatarConfig,
      avatarConfigRevision: row.avatar_config_revision,
    },
    error: null,
  };
}

export async function resetViewerAvatarConfig(input: AvatarResetInput) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("reset_own_avatar_config", {
    p_expected_revision: input.expectedRevision,
  });
  if (error) return { data: null, error };
  const row = data[0];
  if (!row || row.avatar_config !== null)
    throw new Error("avatar_reset_response_invalid");
  return {
    data: {
      avatarConfig: null,
      avatarConfigRevision: row.avatar_config_revision,
    },
    error: null,
  };
}

export async function getPublicProfile(
  handle: string,
): Promise<PublicProfile | null> {
  const supabase = createSupabaseAnonymousClient();
  const { data, error } = await supabase
    .from("public_profiles")
    .select("id, username, display_name, credit_name, bio, avatar_config")
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
    avatarConfig: parseAvatarConfig(data.avatar_config),
  };
}

function validProfileCursor(input: {
  value?: string;
  kind: "profile-projects" | "profile-contributions";
  profileId: string;
  discoveryVersion: number;
}) {
  const cursor = decodeNavigationCursor(input.value);
  if (!input.value) return null;
  if (
    !cursor ||
    cursor.kind !== input.kind ||
    cursor.subject !== input.profileId ||
    cursor.discoveryVersion !== input.discoveryVersion
  )
    throw new Error("profile_cursor_stale");
  return cursor;
}

export async function listPublicProfileAwards(
  profileId: string,
  after?: string,
): Promise<PublicProfilePage<PublicProfileAward>> {
  const cursor = decodeNavigationCursor(after);
  if (
    after &&
    (!cursor ||
      cursor.kind !== "profile-awards" ||
      cursor.subject !== profileId)
  )
    throw new Error("profile_cursor_stale");
  const supabase = createSupabaseAnonymousClient();
  const { data, error } = await supabase.rpc("list_public_profile_awards", {
    p_profile_id: profileId,
    p_after_awarded_at: cursor?.timestamp,
    p_after_id: cursor?.id,
  });
  if (error) throw new Error("public_profile_awards_unavailable");
  const rows = z.array(publicProfileAwardSchema).parse(data);
  const items = rows.slice(0, 12);
  const last = rows.length > 12 ? items.at(-1) : null;
  return {
    items,
    nextCursor: last
      ? encodeNavigationCursor({
          v: 1,
          kind: "profile-awards",
          subject: profileId,
          filter: "",
          timestamp: last.awardedAt,
          id: last.id,
        })
      : null,
  };
}

export async function listPublicProfileProjects(
  profileId: string,
  after?: string,
): Promise<PublicProfilePage<z.infer<typeof publicProjectSchema>>> {
  const discoveryVersion = await getDiscoveryVersion();
  const cursor = validProfileCursor({
    value: after,
    kind: "profile-projects",
    profileId,
    discoveryVersion,
  });
  const supabase = createSupabaseAnonymousClient();
  const { data, error } = await supabase.rpc("list_public_profile_projects", {
    p_profile_id: profileId,
    p_discovery_version: discoveryVersion,
    p_after_published_at: cursor?.timestamp,
    p_after_project_id: cursor?.id,
  });
  if (error)
    throw new Error(
      error.code === "PT409"
        ? "profile_cursor_stale"
        : "public_profile_history_unavailable",
    );
  const rows = z.array(publicProjectSchema).parse(data);
  const items = rows.slice(0, 12);
  const last = rows.length > 12 ? items.at(-1) : null;
  return {
    items,
    nextCursor: last
      ? encodeNavigationCursor({
          v: 1,
          kind: "profile-projects",
          subject: profileId,
          filter: "",
          timestamp: last.publishedAt,
          id: last.projectId,
          discoveryVersion,
        })
      : null,
  };
}

export async function listPublicProfileContributions(
  profileId: string,
  after?: string,
): Promise<PublicProfilePage<AcceptedContributionHistoryItem>> {
  const discoveryVersion = await getDiscoveryVersion();
  const cursor = validProfileCursor({
    value: after,
    kind: "profile-contributions",
    profileId,
    discoveryVersion,
  });
  const supabase = createSupabaseAnonymousClient();
  const { data, error } = await supabase.rpc(
    "list_public_profile_contributions",
    {
      p_profile_id: profileId,
      p_discovery_version: discoveryVersion,
      p_after_accepted_at: cursor?.timestamp,
      p_after_revision_id: cursor?.id,
    },
  );
  if (error)
    throw new Error(
      error.code === "PT409"
        ? "profile_cursor_stale"
        : "public_profile_history_unavailable",
    );
  const rows = z.array(acceptedContributionSchema).parse(data);
  const items = rows.slice(0, 12);
  const last = rows.length > 12 ? items.at(-1) : null;
  return {
    items,
    nextCursor: last
      ? encodeNavigationCursor({
          v: 1,
          kind: "profile-contributions",
          subject: profileId,
          filter: "",
          timestamp: last.acceptedAt,
          id: last.revisionId,
          discoveryVersion,
        })
      : null,
  };
}

export async function touchViewerActivity() {
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("touch_viewer_activity");
  return !error;
}
