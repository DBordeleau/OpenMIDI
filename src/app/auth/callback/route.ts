import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeNextPath } from "@/features/auth/redirect";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = sanitizeNextPath(url.searchParams.get("next"), "/onboarding");
  const { siteUrl } = getServerEnv();
  if (!code)
    return NextResponse.redirect(`${siteUrl}/auth/error?reason=missing_code`);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error)
    return NextResponse.redirect(`${siteUrl}/auth/error?reason=exchange`);
  return NextResponse.redirect(`${siteUrl}${next}`);
}
