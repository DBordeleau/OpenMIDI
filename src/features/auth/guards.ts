import "server-only";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getViewerProfile,
  touchViewerActivity,
} from "@/server/repositories/profiles";
import { assertViewerAdmin } from "@/server/repositories/moderation";

export async function requireViewer(destination: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub)
    redirect(`/sign-in?next=${encodeURIComponent(destination)}`);
  const profile = await getViewerProfile();
  if (!profile) redirect(`/sign-in?next=${encodeURIComponent(destination)}`);
  if (profile.status !== "active") redirect("/account-unavailable");
  await touchViewerActivity();
  return profile;
}

export async function getOptionalViewer() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return getViewerProfile();
}

export async function requireAdmin(destination: string) {
  const profile = await requireViewer(destination);
  if (!(await assertViewerAdmin())) redirect("/account-unavailable");
  return profile;
}
