"use server";

import { redirect } from "next/navigation";
import { getServerEnv } from "@/lib/env/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeNextPath } from "./redirect";

export async function signInWithGoogle(formData: FormData) {
  const next = sanitizeNextPath(
    formData.get("next")?.toString(),
    "/onboarding",
  );
  const { siteUrl } = getServerEnv();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error || !data.url) redirect("/auth/error?reason=provider");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
