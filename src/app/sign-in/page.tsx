import { redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { signInWithGoogle } from "@/features/auth/actions";
import { sanitizeNextPath } from "@/features/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = sanitizeNextPath((await searchParams).next, "/onboarding");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) redirect("/onboarding");
  return (
    <main id="main-content">
      <Container className="flex min-h-screen items-center justify-center py-16">
        <section className="rounded-card border-subtle bg-surface-raised shadow-raised w-full max-w-lg border p-8">
          <p className="text-accent text-sm font-semibold tracking-widest uppercase">
            Jam Session
          </p>
          <h1 className="mt-3 text-3xl font-bold">Sign in to collaborate</h1>
          <p className="text-muted mt-3">
            Jam Session is currently invite-only. Use the Google account
            associated with your invitation.
          </p>
          <form action={signInWithGoogle} className="mt-8">
            <input type="hidden" name="next" value={next} />
            <button
              className="rounded-control bg-accent hover:bg-accent-strong min-h-12 w-full px-5 font-semibold text-slate-950"
              type="submit"
            >
              Continue with Google
            </button>
          </form>
        </section>
      </Container>
    </main>
  );
}
