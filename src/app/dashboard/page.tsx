import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal.client";
import { requireViewer } from "@/features/auth/guards";
import { FeaturedChallengeCard } from "@/features/challenges/featured-challenge-card";
import {
  ArrowLink,
  ClipRows,
  ContributionRows,
  ProjectRows,
  SectionHeader,
} from "@/features/dashboard/launcher-lists";
import { ResumeBand } from "@/features/dashboard/resume-band";
import { StateRail } from "@/features/dashboard/state-rail";
import { AdminInviteForm } from "@/features/invitations/admin-invite-form.client";
import { getViewerDashboard } from "@/server/repositories/dashboard";
import { assertViewerAdmin } from "@/server/repositories/moderation";
import { getFeaturedChallenge } from "@/server/repositories/challenges";

export const metadata: Metadata = { title: "Dashboard" };

/** Short enough to scan without scrolling; "View all" carries the rest. */
const LAUNCHER_ROWS = 5;

/**
 * The dashboard is a launcher, not a report: every row carries the action you
 * came for. There is deliberately no "Dashboard" page heading — the navigation
 * already says where you are, and that space belongs to the work you left open.
 */
export default async function DashboardPage() {
  await requireViewer("/dashboard");
  const [dashboard, isAdmin, featuredChallenge] = await Promise.all([
    getViewerDashboard(),
    assertViewerAdmin(),
    getFeaturedChallenge(),
  ]);

  // A clip cannot exist before a project and a track do, so there is no URL
  // that opens the editor on nothing. The closest honest target is the
  // arrangement already open, where adding a track is one tap.
  const newClipHref = dashboard.resume
    ? `/studio/${dashboard.resume.projectId}`
    : "/studio";

  return (
    <main id="main-content">
      <Container className="py-6 sm:py-10">
        <Reveal>
          <ResumeBand resume={dashboard.resume} />
        </Reveal>

        <Reveal delay={0.06} className="mt-4">
          <StateRail review={dashboard.review} counts={dashboard.counts} />
        </Reveal>

        <div className="mt-7 grid gap-6 sm:mt-10 sm:gap-8 lg:grid-cols-12 lg:gap-6">
          <Reveal
            as="section"
            delay={0.1}
            className="lg:col-span-7"
            aria-labelledby="projects-heading"
          >
            <SectionHeader
              id="projects-heading"
              title="Projects"
              count={dashboard.counts.projects.count}
              viewAll={{ href: "/projects?scope=owned", label: "View all" }}
            >
              <ButtonLink href="/projects/new" prefetch={false}>
                New project
              </ButtonLink>
            </SectionHeader>
            <ProjectRows
              projects={dashboard.ownedProjects.slice(0, LAUNCHER_ROWS)}
            />
          </Reveal>

          <Reveal
            as="section"
            delay={0.14}
            className="lg:col-span-5"
            aria-labelledby="clips-heading"
          >
            <SectionHeader
              id="clips-heading"
              title="Your MIDI clips"
              count={dashboard.counts.clips.count}
              viewAll={{ href: "/library/manage", label: "View all" }}
            >
              <ButtonLink href={newClipHref} prefetch={false}>
                New clip
              </ButtonLink>
            </SectionHeader>
            <ClipRows clips={dashboard.recentClips.slice(0, LAUNCHER_ROWS)} />
          </Reveal>
        </div>

        <div className="mt-7 grid gap-6 sm:mt-10 sm:gap-8 lg:grid-cols-12 lg:gap-6">
          <Reveal
            as="section"
            delay={0.18}
            className="lg:col-span-5"
            aria-labelledby="challenge-heading"
          >
            <SectionHeader
              id="challenge-heading"
              title="This week's challenge"
            />
            <FeaturedChallengeCard featured={featuredChallenge} />
          </Reveal>

          <Reveal
            as="section"
            delay={0.22}
            className="lg:col-span-7"
            aria-labelledby="contributions-heading"
          >
            <SectionHeader
              id="contributions-heading"
              title="Contributions"
              count={dashboard.counts.pendingContributions.count}
              viewAll={{ href: "/contributions", label: "View all" }}
            />
            <ContributionRows contributions={dashboard.pendingContributions} />
          </Reveal>
        </div>

        <Reveal
          as="section"
          delay={0.3}
          className="dash-card rounded-card mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:mt-10 sm:px-5 sm:py-4"
          aria-labelledby="beta-heading"
        >
          <h2 id="beta-heading" className="font-semibold">
            Help tune the next session
          </h2>
          <p className="text-muted min-w-0 flex-1 text-sm">
            Found a rough edge or have an idea? Send a private note to the beta
            team.
          </p>
          <ArrowLink href="/feedback?from=/dashboard">Send feedback</ArrowLink>
          {isAdmin && (
            <ArrowLink href="/admin/feedback">Triage feedback</ArrowLink>
          )}
        </Reveal>

        {isAdmin && (
          <Reveal
            as="section"
            delay={0.34}
            className="dash-card rounded-card mt-4 p-4 sm:p-6"
            aria-labelledby="beta-invite-heading"
          >
            <p className="text-accent font-mono text-[11px] tracking-[0.2em] uppercase">
              Beta access
            </p>
            <h2 id="beta-invite-heading" className="mt-2 text-xl font-bold">
              Invite a collaborator
            </h2>
            <p className="text-muted mt-2 max-w-2xl text-sm">
              Add one musician to the beta list so they can join with their
              matching Google account.
            </p>
            <AdminInviteForm />
          </Reveal>
        )}
      </Container>
    </main>
  );
}
