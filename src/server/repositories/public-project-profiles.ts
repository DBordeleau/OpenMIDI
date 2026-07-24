import "server-only";

import { createSupabaseAnonymousClient } from "@/lib/supabase/anonymous";

const MAX_PUBLIC_PROJECT_PROFILES = 64;

export type PublicProjectProfile = {
  username: string;
  displayName: string;
  avatarConfig: unknown;
};

/**
 * Detail-only profile projection for one already-visible public project.
 *
 * The security-invoker `public_profiles` view keeps lifecycle RLS authoritative,
 * while the explicit columns avoid widening discovery-card payloads.
 */
export async function getPublicProjectProfiles(ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return new Map<string, PublicProjectProfile>();
  if (uniqueIds.length > MAX_PUBLIC_PROJECT_PROFILES)
    throw new Error("public_project_profile_limit");

  const db = createSupabaseAnonymousClient();
  const { data, error } = await db
    .from("public_profiles")
    .select("id,username,display_name,avatar_config")
    .in("id", uniqueIds)
    .limit(MAX_PUBLIC_PROJECT_PROFILES);
  if (error) throw new Error("public_project_profiles_unavailable");

  return new Map(
    data.flatMap((profile) =>
      profile.id && profile.username && profile.display_name
        ? [
            [
              profile.id,
              {
                username: profile.username,
                displayName: profile.display_name,
                avatarConfig: profile.avatar_config,
              },
            ] as const,
          ]
        : [],
    ),
  );
}
