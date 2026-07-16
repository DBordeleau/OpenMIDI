import { redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { restoreAccountAction } from "@/features/moderation/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const recoverySchema = z.object({
  requestId: z.string().uuid(),
  requestedAt: z.string(),
  restoreUntil: z.string(),
  canRestore: z.boolean(),
  username: z.string(),
});

export default async function AccountRecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; signOut?: string; error?: string }>;
}) {
  const db = await createSupabaseServerClient();
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/sign-in?next=%2Faccount-recovery");
  const { data, error } = await db.rpc("get_own_account_recovery");
  if (error || !data) redirect("/account-unavailable");
  const recovery = recoverySchema.parse(data);
  const query = await searchParams;
  return (
    <main id="main-content">
      <Container className="py-16">
        <section className="mx-auto max-w-xl">
          <h1 className="text-4xl font-bold">Account recovery</h1>
          {query.deleted && (
            <p
              role="status"
              className="border-accent rounded-control mt-6 border p-4"
            >
              Account deletion started.{" "}
              {query.signOut === "partial"
                ? "Global sign-out could not be confirmed, but application access is blocked."
                : "Refresh tokens were revoked."}
            </p>
          )}
          <p className="text-muted mt-4">
            Requested {new Date(recovery.requestedAt).toLocaleString()}.
            Recovery closes {new Date(recovery.restoreUntil).toLocaleString()}.
          </p>
          {query.error && (
            <p role="alert" className="text-danger mt-4">
              Recovery is no longer available or is blocked by moderation.
            </p>
          )}
          {recovery.canRestore ? (
            <form action={restoreAccountAction} className="mt-6">
              <button className="cta-gradient text-accent-contrast min-h-11 rounded-full px-5 font-semibold">
                Restore account
              </button>
            </form>
          ) : (
            <p className="mt-6 font-semibold">
              The recovery window has closed.
            </p>
          )}
        </section>
      </Container>
    </main>
  );
}
