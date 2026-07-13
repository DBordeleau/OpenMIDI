import "server-only";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewerProfile } from "@/server/repositories/profiles";

export async function requireViewer(destination: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub)
    redirect(`/sign-in?next=${encodeURIComponent(destination)}`);
  const profile = await getViewerProfile();
  if (!profile) redirect(`/sign-in?next=${encodeURIComponent(destination)}`);
  if (profile.status !== "active") redirect("/account-unavailable");
  return profile;
}
