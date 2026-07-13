import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { signOut } from "@/features/auth/actions";
import { requireViewer } from "@/features/auth/guards";
import { ProfileForm } from "@/features/profiles/profile-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listViewerAcceptedContributions } from "@/server/repositories/profiles";

export default async function ProfileSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const profile = await requireViewer("/settings/profile");
  if (!profile.profileCompletedAt) redirect("/onboarding");
  const supabase = await createSupabaseServerClient();
  const [{ data: authData }, acceptedContributions] = await Promise.all([
    supabase.auth.getUser(),
    listViewerAcceptedContributions(profile.id),
  ]);
  const saved = (await searchParams).saved === "1";
  return (
    <main id="main-content">
      <Container className="py-16">
        <section className="mx-auto max-w-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-accent font-semibold">Account settings</p>
              <h1 className="mt-2 text-4xl font-bold">Edit profile</h1>
              {authData.user?.email && (
                <p className="text-muted mt-2">
                  Signed in as {authData.user.email}
                </p>
              )}
            </div>
            <form action={signOut}>
              <button
                className="rounded-control border-strong min-h-11 border px-4"
                type="submit"
              >
                Sign out
              </button>
            </form>
            <Link
              className="rounded-control bg-accent px-4 py-2 font-semibold text-slate-950"
              href="/projects/new"
            >
              New project
            </Link>
          </div>
          {saved && (
            <p
              role="status"
              className="rounded-control border-accent mt-6 border p-3"
            >
              Profile saved.{" "}
              <Link className="underline" href={`/@${profile.username}`}>
                View public profile
              </Link>
            </p>
          )}
          <ProfileForm profile={profile} />
          <section className="border-subtle mt-10 border-t pt-8">
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
          </section>
        </section>
      </Container>
    </main>
  );
}
