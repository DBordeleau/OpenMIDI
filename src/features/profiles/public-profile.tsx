import Link from "next/link";
import { FiFlag, FiFolder, FiGitPullRequest } from "react-icons/fi";
import { Avatar } from "@/components/ui/avatar";
import { TrophyCase } from "@/features/awards/trophy-case";
import type { PublicProfileAward } from "@/features/awards/contract";
import { ProfileContributionCard } from "./profile-contribution-card";
import { ProfileEmptyState } from "./profile-empty-state";
import { ProfileOwnerAction } from "./profile-owner-action.client";
import { ProfileProjectCard } from "./profile-project-card";
import type {
  AcceptedContributionHistoryItem,
  PublicProfile,
  PublicProfileProject,
} from "./types";

export function PublicProfileView({
  profile,
  projects,
  contributions,
  awards,
  projectNextHref,
  contributionNextHref,
  awardNextHref,
  cursorStale = false,
}: {
  profile: PublicProfile;
  projects: PublicProfileProject[];
  contributions: AcceptedContributionHistoryItem[];
  awards: PublicProfileAward[];
  projectNextHref: string | null;
  contributionNextHref: string | null;
  awardNextHref: string | null;
  cursorStale?: boolean;
}) {
  return (
    <article className="mx-auto max-w-6xl">
      <header className="dash-card dash-card-lit rounded-card border-subtle relative overflow-hidden border p-4 sm:p-5 lg:p-6">
        <div
          aria-hidden="true"
          className="bg-accent/8 absolute -top-16 -right-16 size-48 rounded-full blur-3xl"
        />
        <div
          aria-hidden="true"
          className="bg-berry/8 absolute -bottom-20 left-1/3 size-48 rounded-full blur-3xl"
        />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:items-start lg:gap-6">
          <div className="grid min-w-0 gap-4 min-[23rem]:grid-cols-[auto_minmax(0,1fr)] min-[23rem]:items-start sm:items-center sm:gap-5">
            <div className="border-strong bg-surface/45 relative flex size-28 items-center justify-center rounded-full border p-1.5 shadow-[0_1.25rem_2.5rem_-1.5rem_rgb(0_0_0_/_75%)]">
              <div
                aria-hidden="true"
                className="from-accent/35 to-accent-2/20 absolute inset-1.5 rounded-full bg-linear-to-br opacity-50 blur-md"
              />
              <div className="relative flex">
                <Avatar
                  avatarConfig={profile.avatarConfig}
                  name={profile.displayName}
                  size="lg"
                />
              </div>
            </div>

            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-[-0.035em] text-balance sm:text-4xl">
                {profile.displayName}
              </h1>
              <p className="text-accent mt-1 text-base font-semibold sm:text-lg">
                @{profile.username}
              </p>

              {profile.bio ? (
                <p className="text-ink/90 mt-3 max-w-[54ch] text-sm leading-6 whitespace-pre-wrap sm:text-base sm:leading-7">
                  {profile.bio}
                </p>
              ) : (
                <p className="text-muted mt-3 max-w-[48ch] text-sm leading-6">
                  Public projects, collaborations, and challenge awards live
                  here.
                </p>
              )}

              <div className="border-subtle mt-4 flex flex-wrap items-end gap-3 border-t pt-4">
                <p className="mr-auto min-w-0 text-sm">
                  <span className="text-muted block font-mono text-[10px] tracking-[0.16em] uppercase">
                    MIDI credits
                  </span>
                  <span className="mt-0.5 block font-semibold break-words">
                    {profile.creditName}
                  </span>
                </p>
                <ProfileOwnerAction profileUsername={profile.username} />
                <Link
                  className="border-strong text-muted hover:border-accent hover:text-accent inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors"
                  href={`/reports/new?kind=profile&id=${profile.id}&label=${encodeURIComponent(`@${profile.username}`)}`}
                >
                  <FiFlag aria-hidden="true" />
                  Report this profile
                </Link>
              </div>
            </div>
          </div>

          <TrophyCase awards={awards} nextHref={awardNextHref} />
        </div>
      </header>

      {cursorStale && (
        <p
          role="status"
          className="border-accent bg-surface/80 rounded-card mt-4 border px-5 py-4"
        >
          This profile changed while you were browsing. Showing the newest
          results.
        </p>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <section aria-labelledby="profile-projects-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-1">
            <h2
              id="profile-projects-heading"
              className="text-2xl font-bold tracking-[-0.025em] sm:text-3xl"
            >
              Public Projects
            </h2>
            {projects.length > 0 && (
              <p className="text-muted text-sm">
                Published arrangements, ready to hear.
              </p>
            )}
          </div>

          {projects.length > 0 ? (
            <ul className="grid gap-3">
              {projects.map((project) => (
                <li key={project.projectId} className="flex">
                  <ProfileProjectCard project={project} />
                </li>
              ))}
            </ul>
          ) : (
            <ProfileEmptyState
              Icon={FiFolder}
              title="The set list is still open."
              message="When this artist publishes a MIDI project, it will become part of their public body of work here."
            />
          )}
          {projectNextHref && (
            <Link
              className="border-strong hover:border-accent hover:text-accent mt-4 inline-flex min-h-11 items-center rounded-full border px-5 font-semibold transition-colors"
              href={projectNextHref}
            >
              Next projects
            </Link>
          )}
        </section>

        <section aria-labelledby="profile-contributions-heading">
          <div className="mb-3 px-1">
            <h2
              id="profile-contributions-heading"
              className="text-2xl font-bold tracking-[-0.025em] sm:text-3xl"
            >
              Accepted Contributions
            </h2>
          </div>

          {contributions.length > 0 ? (
            <ul className="grid gap-3">
              {contributions.map((contribution) => (
                <li key={contribution.revisionId} className="flex">
                  <ProfileContributionCard contribution={contribution} />
                </li>
              ))}
            </ul>
          ) : (
            <ProfileEmptyState
              Icon={FiGitPullRequest}
              title="No accepted contributions yet."
              message="Collaborative parts that make it into a public arrangement will be credited here."
            />
          )}
          {contributionNextHref && (
            <Link
              className="border-strong hover:border-accent hover:text-accent mt-4 inline-flex min-h-11 items-center rounded-full border px-5 font-semibold transition-colors"
              href={contributionNextHref}
            >
              Next contributions
            </Link>
          )}
        </section>
      </div>
    </article>
  );
}
