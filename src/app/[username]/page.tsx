import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { PublicProfileView } from "@/features/profiles/public-profile";
import {
  getPublicProfile,
  listPublicProfileAwards,
  listPublicProfileContributions,
  listPublicProfileProjects,
} from "@/server/repositories/profiles";

type ProfileSearchParams = {
  projectsAfter?: string;
  contributionsAfter?: string;
  awardsAfter?: string;
};

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

function profilePageHref(
  base: string,
  query: ProfileSearchParams,
  patch: ProfileSearchParams,
) {
  const merged = { ...query, ...patch };
  const params = new URLSearchParams();
  if (merged.projectsAfter) params.set("projectsAfter", merged.projectsAfter);
  if (merged.contributionsAfter)
    params.set("contributionsAfter", merged.contributionsAfter);
  if (merged.awardsAfter) params.set("awardsAfter", merged.awardsAfter);
  const suffix = params.toString();
  return suffix ? `${base}?${suffix}` : base;
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
  searchParams: Promise<ProfileSearchParams>;
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
  const visibleQuery = cursorStale ? {} : query;

  return (
    <main id="main-content">
      <Container className="py-6 sm:py-10">
        <PublicProfileView
          profile={profile}
          projects={projects.items}
          contributions={contributions.items}
          awards={awards.items}
          cursorStale={cursorStale}
          projectNextHref={
            projects.nextCursor
              ? profilePageHref(base, visibleQuery, {
                  projectsAfter: projects.nextCursor,
                })
              : null
          }
          contributionNextHref={
            contributions.nextCursor
              ? profilePageHref(base, visibleQuery, {
                  contributionsAfter: contributions.nextCursor,
                })
              : null
          }
          awardNextHref={
            awards.nextCursor
              ? profilePageHref(base, visibleQuery, {
                  awardsAfter: awards.nextCursor,
                })
              : null
          }
        />
      </Container>
    </main>
  );
}
