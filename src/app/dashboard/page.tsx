import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { IntentPrefetchLink } from "@/components/navigation/intent-prefetch-link.client";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal.client";
import { requireViewer } from "@/features/auth/guards";
import { FeaturedChallengeCard } from "@/features/challenges/featured-challenge-card";
import { AdminInviteForm } from "@/features/invitations/admin-invite-form.client";
import { getViewerDashboard } from "@/server/repositories/dashboard";
import { assertViewerAdmin } from "@/server/repositories/moderation";
import { getFeaturedChallenge } from "@/server/repositories/challenges";

export const metadata: Metadata = { title: "Dashboard" };

function Empty({
  children,
  href,
  action,
}: {
  children: React.ReactNode;
  href: string;
  action: string;
}) {
  return (
    <div className="border-subtle rounded-card mt-4 border border-dashed p-5">
      <p className="text-muted">{children}</p>
      <IntentPrefetchLink
        className="text-accent mt-3 inline-block font-semibold"
        href={href}
      >
        {action} →
      </IntentPrefetchLink>
    </div>
  );
}

export default async function DashboardPage() {
  await requireViewer("/dashboard");
  const [dashboard, isAdmin, featuredChallenge] = await Promise.all([
    getViewerDashboard(),
    assertViewerAdmin(),
    getFeaturedChallenge(),
  ]);
  return (
    <main id="main-content">
      <Container className="py-12 sm:py-16">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-accent-2 font-mono text-xs font-semibold tracking-[0.18em] uppercase">
              Your session
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
              Dashboard
            </h1>
            <p className="text-muted mt-3 text-lg">
              Pick up the work that needs you next.
            </p>
          </div>
          <ButtonLink href="/projects/new" prefetch={false}>
            New project
          </ButtonLink>
        </Reveal>
        <FeaturedChallengeCard featured={featuredChallenge} />
        <Reveal
          as="section"
          delay={0.08}
          className="rounded-card border-strong mt-10 border p-6"
          style={{
            background:
              "radial-gradient(130% 140% at 0% 0%,rgba(255,141,99,0.14),transparent 55%),var(--color-surface-raised)",
          }}
          aria-labelledby="review-heading"
        >
          <p className="text-accent font-mono text-xs uppercase">
            Review queue
          </p>
          <h2 id="review-heading" className="mt-2 text-2xl font-semibold">
            {dashboard.review.hasMore ? "99+" : dashboard.review.count} awaiting
            review
          </h2>
          <IntentPrefetchLink
            className="text-accent mt-3 inline-block font-semibold"
            href="/projects?scope=owned&review=1"
          >
            Open projects needing review →
          </IntentPrefetchLink>
        </Reveal>
        <Reveal
          as="section"
          delay={0.1}
          className="rounded-card border-subtle bg-surface mt-8 border p-6"
          aria-labelledby="feedback-heading"
        >
          <p className="text-accent font-mono text-xs uppercase">
            OpenMIDI beta
          </p>
          <h2 id="feedback-heading" className="mt-2 text-2xl font-semibold">
            Help tune the next session
          </h2>
          <p className="text-muted mt-2">
            Found a rough edge or have an idea? Send a private note to the beta
            team.
          </p>
          <IntentPrefetchLink
            className="text-accent mt-3 inline-block font-semibold"
            href="/feedback?from=/dashboard"
          >
            Send feedback →
          </IntentPrefetchLink>
          {isAdmin && <span className="text-muted mx-3">·</span>}
          {isAdmin && (
            <IntentPrefetchLink
              className="text-accent mt-3 inline-block font-semibold"
              href="/admin/feedback"
            >
              Triage feedback →
            </IntentPrefetchLink>
          )}
        </Reveal>
        {isAdmin && (
          <Reveal
            as="section"
            delay={0.1}
            className="rounded-card border-subtle bg-surface-raised mt-8 border p-6 shadow-[0_24px_70px_-45px_#000] sm:p-7"
            aria-labelledby="beta-invite-heading"
          >
            <p className="text-accent font-mono text-[11px] tracking-[0.2em] uppercase">
              Beta access
            </p>
            <h2
              id="beta-invite-heading"
              className="mt-2 text-2xl font-semibold"
            >
              Invite a collaborator
            </h2>
            <p className="text-muted mt-2 max-w-2xl">
              Add one musician to the beta list so they can join with their
              matching Google account.
            </p>
            <AdminInviteForm />
          </Reveal>
        )}
        <Reveal delay={0.12} className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-card border-subtle bg-surface border p-6">
            <div className="flex justify-between gap-4">
              <h2 className="text-2xl font-semibold">Owned projects</h2>
              <IntentPrefetchLink
                className="text-accent"
                href="/projects?scope=owned"
              >
                View all
              </IntentPrefetchLink>
            </div>
            {dashboard.ownedProjects.length ? (
              <ul className="divide-subtle mt-4 divide-y">
                {dashboard.ownedProjects.map((item) => (
                  <li className="py-4" key={item.projectId}>
                    <IntentPrefetchLink
                      className="hover:text-accent font-semibold"
                      href={`/projects/${item.projectId}`}
                    >
                      {item.title}
                    </IntentPrefetchLink>
                    <p className="text-muted mt-1 text-sm capitalize">
                      {item.status} · Updated{" "}
                      <time dateTime={item.updatedAt}>
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </time>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty href="/projects/new" action="Create a project">
                Start a project and publish your first revision.
              </Empty>
            )}
          </section>
          <section className="rounded-card border-subtle bg-surface border p-6">
            <div className="flex justify-between gap-4">
              <h2 className="text-2xl font-semibold">Active workspaces</h2>
              <IntentPrefetchLink className="text-accent" href="/projects">
                View projects
              </IntentPrefetchLink>
            </div>
            {dashboard.activeWorkspaces.length ? (
              <ul className="divide-subtle mt-4 divide-y">
                {dashboard.activeWorkspaces.map((item) => (
                  <li className="py-4" key={item.workspaceId}>
                    <IntentPrefetchLink
                      className="hover:text-accent font-semibold"
                      href={
                        item.contributionId
                          ? `/projects/${item.projectId}/contributions/${item.contributionId}`
                          : `/studio/${item.projectId}`
                      }
                    >
                      {item.contributionTitle ?? item.projectTitle}
                    </IntentPrefetchLink>
                    <p className="text-muted mt-1 text-sm">
                      {item.projectTitle} · Updated{" "}
                      <time dateTime={item.updatedAt}>
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </time>
                    </p>
                    {item.archiveWarning && (
                      <p className="text-danger mt-2 text-sm font-semibold">
                        This workspace archives on{" "}
                        {new Date(item.archivesAt).toLocaleDateString()}. Save
                        or publish to keep it active.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty href="/projects" action="Open your projects">
                A workspace appears after you begin arranging a project or
                contribution.
              </Empty>
            )}
          </section>
          <section className="rounded-card border-subtle bg-surface border p-6 lg:col-span-2">
            <div className="flex justify-between gap-4">
              <h2 className="text-2xl font-semibold">Pending contributions</h2>
              <IntentPrefetchLink className="text-accent" href="/contributions">
                View all
              </IntentPrefetchLink>
            </div>
            {dashboard.pendingContributions.length ? (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {dashboard.pendingContributions.map((item) => (
                  <li
                    className="rounded-control border-subtle border p-4"
                    key={item.contributionId}
                  >
                    <IntentPrefetchLink
                      className="hover:text-accent font-semibold"
                      href={`/projects/${item.projectId}/contributions/${item.contributionId}`}
                    >
                      {item.title}
                    </IntentPrefetchLink>
                    <p className="text-muted mt-1 text-sm">
                      {item.projectTitle} · {item.status.replaceAll("_", " ")}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty href="/explore" action="Explore open projects">
                Your drafts and submitted proposals will appear here.
              </Empty>
            )}
          </section>
        </Reveal>
      </Container>
    </main>
  );
}
