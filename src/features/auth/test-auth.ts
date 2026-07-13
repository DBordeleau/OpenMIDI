import "server-only";

import { notFound, redirect } from "next/navigation";
import { getServerEnv } from "@/lib/env/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export function requireTestAuthConfig() {
  const env = getServerEnv();
  if (process.env.NODE_ENV === "production" || !env.enableTestAuth) notFound();
  if (!env.testAuthEmail || !env.testAuthPassword)
    throw new Error("test_auth_configuration_missing");
  return { email: env.testAuthEmail, password: env.testAuthPassword };
}

export async function signInTestActor() {
  "use server";
  const credentials = requireTestAuthConfig();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) redirect("/auth/error?reason=test_auth");
  redirect("/onboarding");
}
