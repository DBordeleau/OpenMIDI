import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { Avatar } from "@/components/ui/avatar";
import Link from "next/link";
import { AwardGallery } from "@/features/awards/award-gallery";
import {
  getPublicProfile,
  listPublicProfileContributions,
  listPublicProfileProjects,
  listPublicProfileAwards,
} from "@/server/repositories/profiles";

async function find(raw: string) {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!decoded.startsWith("@")) return null;
  const handle = decoded.slice(1);
  if (!/^[A-Za-z0-9_]{3,30}$/.test(handle)) return null;
  return getPublicProfile(handle);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const profile = await find((await params).username);
  return profile
    ? {
        title: `${profile.displayName} (@${profile.username})`,
        description: profile.bio ?? `Music profile for @${profile.username}.`,
      }
    : {};
}

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{
    projectsAfter?: string;
    contributionsAfter?: string;
    awardsAfter?: string;
  }>;
}) {
  const profile = await find((await params).username);
  if (!profile) notFound();
  const query = await searchParams;
  let projects;
  let contributions;
  let awards;
  let cursorStale = false;
  try {
    [projects, contributions, awards] = await Promise.all([
      listPublicProfileProjects(profile.id, query.projectsAfter),
      listPublicProfileContributions(profile.id, query.contributionsAfter),
      listPublicProfileAwards(profile.id, query.awardsAfter),
    ]);
  } catch (error) {
    if (error instanceof Error && error.message === "profile_cursor_stale")
      cursorStale = true;
    else throw error;
    [projects, contributions, awards] = await Promise.all([
      listPublicProfileProjects(profile.id),
      listPublicProfileContributions(profile.id),
      listPublicProfileAwards(profile.id),
    ]);
  }
  const base = `/@${profile.username}`;
  return (
    <main id="main-content">
      <Container className="py-20">
        <article className="mx-auto max-w-3xl">
          <Avatar
            avatarConfig={profile.avatarConfig}
            name={profile.displayName}
            size="lg"
          />
          <h1 className="mt-6 text-4xl font-bold">{profile.displayName}</h1>
          <p className="text-accent mt-2 text-lg">@{profile.username}</p>
          <p className="text-muted mt-1">
            MIDI pattern attribution: {profile.creditName}
          </p>
          {profile.bio && (
            <p className="mt-8 max-w-prose text-lg leading-8 whitespace-pre-wrap">
              {profile.bio}
            </p>
          )}
          <Link
            className="text-muted hover:text-accent mt-5 inline-block text-sm underline"
            href={`/reports/new?kind=profile&id=${profile.id}&label=${encodeURIComponent(`@${profile.username}`)}`}
          >
            Report this profile
          </Link>
          {cursorStale && (
            <p
              role="status"
              className="rounded-control border-accent mt-8 border p-4"
            >
              This profile changed while you were browsing. Showing the newest
              results.
            </p>
          )}
          <AwardGallery
            awards={awards.items}
            nextHref={
              awards.nextCursor
                ? `${base}?awardsAfter=${encodeURIComponent(awards.nextCursor)}${query.projectsAfter ? `&projectsAfter=${encodeURIComponent(query.projectsAfter)}` : ""}${query.contributionsAfter ? `&contributionsAfter=${encodeURIComponent(query.contributionsAfter)}` : ""}`
                : null
            }
          />
          <section className="border-subtle mt-10 border-t pt-8">
            <h2 className="text-2xl font-bold">Public MIDI projects</h2>
            {projects.items.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {projects.items.map((project) => (
                  <li key={project.projectId}>
                    <Link
                      className="underline"
                      href={`/projects/${project.projectId}`}
                    >
                      {project.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted mt-3">No public MIDI projects yet.</p>
            )}
            {projects.nextCursor && (
              <Link
                className="border-strong mt-5 inline-flex min-h-11 items-center rounded-full border px-5 font-semibold"
                href={`${base}?projectsAfter=${encodeURIComponent(projects.nextCursor)}${query.contributionsAfter ? `&contributionsAfter=${encodeURIComponent(query.contributionsAfter)}` : ""}`}
              >
                Next projects
              </Link>
            )}
          </section>
          <section className="border-subtle mt-10 border-t pt-8">
            <h2 className="text-2xl font-bold">
              Accepted arrangement contributions
            </h2>
            {contributions.items.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {contributions.items.map((item) => (
                  <li key={item.revisionId}>
                    <Link
                      className="underline"
                      href={`/projects/${item.projectId}`}
                    >
                      {item.projectTitle}
                    </Link>{" "}
                    <span className="text-muted">
                      · revision {item.revisionNumber}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted mt-3">
                No public accepted contributions yet.
              </p>
            )}
            {contributions.nextCursor && (
              <Link
                className="border-strong mt-5 inline-flex min-h-11 items-center rounded-full border px-5 font-semibold"
                href={`${base}?contributionsAfter=${encodeURIComponent(contributions.nextCursor)}${query.projectsAfter ? `&projectsAfter=${encodeURIComponent(query.projectsAfter)}` : ""}`}
              >
                Next contributions
              </Link>
            )}
          </section>
        </article>
      </Container>
    </main>
  );
}
