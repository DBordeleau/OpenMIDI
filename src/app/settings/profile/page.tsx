import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { Reveal } from "@/components/ui/reveal.client";
import { signOut } from "@/features/auth/actions";
import { requireViewer } from "@/features/auth/guards";
import { ProfileForm } from "@/features/profiles/profile-form";
import { Avatar } from "@/components/ui/avatar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listViewerAcceptedContributions } from "@/server/repositories/profiles";
import { AccountDeletionForm } from "@/features/moderation/account-deletion-form";
import { assertViewerAdmin } from "@/server/repositories/moderation";

export default async function ProfileSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; avatar?: string }>;
}) {
  const profile = await requireViewer("/settings/profile");
  if (!profile.profileCompletedAt) redirect("/onboarding");
  const supabase = await createSupabaseServerClient();
  const [{ data: authData }, acceptedContributions, isAdmin] =
    await Promise.all([
      supabase.auth.getUser(),
      listViewerAcceptedContributions(profile.id),
      assertViewerAdmin(),
    ]);
  const query = await searchParams;
  const saved = query.saved === "1";
  return (
    <main id="main-content">
      <Container className="py-16">
        <section className="mx-auto max-w-2xl">
          <Reveal className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-accent-2 font-mono text-[11px] font-semibold tracking-[0.2em] uppercase">
                Account settings
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-[-0.02em]">
                Edit profile
              </h1>
              {authData.user?.email && (
                <p className="text-muted mt-2">
                  Signed in as {authData.user.email}
                </p>
              )}
            </div>
            <form action={signOut}>
              <button
                className="border-strong text-ink hover:border-accent hover:text-accent inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold transition-colors"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </Reveal>
          {saved && (
            <p
              role="status"
              className="rounded-control border-accent/50 mt-6 border p-3 text-sm"
              style={{ background: "rgba(255,141,99,0.08)" }}
            >
              Profile saved.{" "}
              <Link
                className="text-accent font-semibold underline"
                href={`/@${profile.username}`}
              >
                View public profile
              </Link>
            </p>
          )}
          {(query.avatar === "saved" || query.avatar === "reset") && (
            <p
              role="status"
              className="rounded-control border-accent/50 mt-6 border p-3 text-sm"
            >
              {query.avatar === "saved"
                ? "Avatar saved across your profile."
                : "Avatar reset to initials."}
            </p>
          )}
          <Reveal delay={0.08}>
            <section className="dash-card dash-card-lit mt-8 flex flex-wrap items-center justify-between gap-5 p-5 sm:p-6">
              <div className="flex min-w-0 items-center gap-4">
                <Avatar
                  avatarConfig={profile.avatarConfig}
                  name={profile.displayName ?? "OpenMIDI member"}
                  size="md"
                />
                <div className="min-w-0">
                  <h2 className="text-xl font-bold">Your profile avatar</h2>
                  <p className="text-muted mt-1 text-sm">
                    {profile.avatarConfig
                      ? "A locally generated face with no uploaded photo."
                      : "Initials now; build a face whenever you like."}
                  </p>
                </div>
              </div>
              <Link
                href="/settings/avatar"
                className="cta-gradient inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold"
              >
                Customize avatar
              </Link>
            </section>
          </Reveal>
          <Reveal delay={0.12}>
            <ProfileForm profile={profile} />
          </Reveal>
          <Reveal
            as="section"
            delay={0.16}
            className="border-subtle mt-10 border-t pt-8"
          >
            <h2 className="text-2xl font-bold">Accepted contributions</h2>
            {acceptedContributions.length ? (
              <ol className="mt-4 space-y-3">
                {acceptedContributions.map((item) => (
                  <li
                    className="rounded-control border-subtle border p-4"
                    key={item.revisionId}
                  >
                    <Link
                      className="font-semibold underline"
                      href={`/projects/${item.projectId}#revision-${item.revisionNumber}`}
                    >
                      {item.projectTitle} · revision {item.revisionNumber}
                    </Link>
                    <p className="text-muted mt-1 text-sm">
                      Credited as {item.creditName} ·{" "}
                      {new Date(item.acceptedAt).toLocaleDateString()}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-muted mt-3">No accepted contributions yet.</p>
            )}
          </Reveal>
          {isAdmin && (
            <Reveal
              as="section"
              delay={0.18}
              className="border-subtle mt-10 border-t pt-8"
            >
              <h2 className="text-2xl font-bold">Administration</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  className="border-strong rounded-full border px-5 py-3 font-semibold"
                  href="/admin/moderation"
                >
                  Moderation queue
                </Link>
                <Link
                  className="border-strong rounded-full border px-5 py-3 font-semibold"
                  href="/admin/operations"
                >
                  Retention operations
                </Link>
              </div>
            </Reveal>
          )}
          {profile.username && (
            <Reveal
              as="section"
              delay={0.2}
              className="border-danger/50 mt-10 border-t pt-8"
            >
              <p className="text-danger font-mono text-xs uppercase">
                Danger zone
              </p>
              <h2 className="mt-2 text-2xl font-bold">Delete account</h2>
              <p className="text-muted mt-3">
                Your profile and owned projects disappear immediately. You can
                recover for 30 days when moderation permits. Published credits
                and fork lineage survive as unavailable history. Your generated
                avatar configuration is cleared immediately. Existing access
                tokens can remain valid until their short expiry, so OpenMIDI
                continues enforcing deleted-account checks at every protected
                boundary.
              </p>
              <AccountDeletionForm username={profile.username} />
            </Reveal>
          )}
        </section>
      </Container>
    </main>
  );
}
