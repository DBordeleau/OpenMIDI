import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { IntentPrefetchLink } from "@/components/navigation/intent-prefetch-link.client";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal.client";
import { requireViewer } from "@/features/auth/guards";
import {
  ProjectScopeTabs,
  type ProjectScope,
} from "@/features/projects/project-scope-tabs";
import { listProjectsForViewer } from "@/server/repositories/projects";
import { restoreProjectAction } from "@/features/moderation/actions";

export const metadata: Metadata = { title: "My projects" };

const statusLabels = {
  active: "Active",
  archived: "Archived",
  draft: "Draft",
} as const;

function StatusChip({
  tone,
  children,
}: {
  tone: "accent" | "gold" | "muted";
  children: React.ReactNode;
}) {
  const tones = {
    accent: "border-accent/45 bg-accent/10 text-accent",
    gold: "border-accent-2/50 bg-accent-2/10 text-accent-2",
    muted: "border-subtle text-muted",
  } as const;
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] tracking-widest uppercase ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    scope?: string;
    review?: string;
    after?: string;
    deleted?: string;
    projectId?: string;
    restoreError?: string;
  }>;
}) {
  const viewer = await requireViewer("/projects");
  const query = await searchParams;
  const scope = query.scope === "owned" ? "owned" : "all";
  const review = query.review === "1" && scope === "owned";
  const { projects, nextCursor } = await listProjectsForViewer(viewer.id, {
    scope,
    review,
    after: query.after,
  });
  const currentScope: ProjectScope = review
    ? "review"
    : scope === "owned"
      ? "owned"
      : "all";

  return (
    <main id="main-content">
      {/* Same rhythm as the library: the work is the page, so the header gets
          one line and the grid starts above the fold. */}
      <Container className="py-6 sm:py-10">
        <Reveal>
          <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div>
              <p className="text-accent-2 font-mono text-[11px] tracking-[0.2em] uppercase">
                Your music workspace
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-balance sm:text-3xl">
                My projects
              </h1>
            </div>
            <ButtonLink href="/projects/new" prefetch={false}>
              New project
            </ButtonLink>
          </header>
        </Reveal>

        <Reveal delay={0.06} className="mt-5">
          <ProjectScopeTabs current={currentScope} />
        </Reveal>

        {query.deleted === "1" && (
          <div
            role="status"
            className="border-accent bg-surface rounded-control mt-5 border p-4"
          >
            Project deleted. Its history remains recoverable for 30 days.
            {query.projectId && (
              <form action={restoreProjectAction} className="mt-3">
                <input type="hidden" name="projectId" value={query.projectId} />
                <button className="text-accent font-semibold underline">
                  Restore project
                </button>
              </form>
            )}
          </div>
        )}
        {query.restoreError === "1" && (
          <p role="alert" className="text-danger mt-5">
            That project can no longer be restored.
          </p>
        )}

        {projects.length > 0 ? (
          <section className="mt-6" aria-labelledby="project-list-heading">
            <Reveal delay={0.1} className="px-1">
              <h2 id="project-list-heading" className="text-muted text-sm">
                <span className="text-ink font-semibold">
                  {projects.length}{" "}
                  {projects.length === 1 ? "project" : "projects"}
                </span>{" "}
                ·{" "}
                {currentScope === "review"
                  ? "waiting on your review"
                  : currentScope === "owned"
                    ? "owned by you"
                    : "everything you can open"}
              </h2>
            </Reveal>
            <ul className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project, index) => (
                <Reveal
                  as="li"
                  key={project.id}
                  delay={0.14 + Math.min(index, 8) * 0.05}
                  className="flex"
                >
                  {/* The row itself opens the project; the single button goes
                      to the Studio — the same split the dashboard uses. */}
                  <article className="dash-card dash-card-action rounded-card group relative flex w-full flex-col p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusChip
                        tone={project.status === "active" ? "accent" : "muted"}
                      >
                        {statusLabels[project.status]}
                      </StatusChip>
                      {project.needsReview && (
                        <StatusChip tone="gold">Review pending</StatusChip>
                      )}
                      <span className="text-muted ml-auto font-mono text-[10.5px] tracking-widest uppercase">
                        {project.role}
                      </span>
                    </div>

                    <h3 className="mt-3 text-xl font-bold tracking-[-0.02em] text-balance">
                      <IntentPrefetchLink
                        className="group-hover:text-accent transition-colors after:absolute after:inset-0 after:rounded-[inherit]"
                        href={`/projects/${project.id}`}
                      >
                        {project.title}
                      </IntentPrefetchLink>
                    </h3>

                    <p className="text-muted mt-2 line-clamp-2 text-sm">
                      {project.description ||
                        "No description yet. Add context so collaborators understand the direction."}
                    </p>

                    <p className="text-muted mt-3 font-mono text-[11px]">
                      {project.currentRevisionId ? "Published" : "No revision"}{" "}
                      · updated{" "}
                      <time dateTime={project.updatedAt}>
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </time>
                    </p>

                    <div className="mt-auto pt-4">
                      {project.currentRevisionId || project.role === "owner" ? (
                        <IntentPrefetchLink
                          className="border-strong hover:border-accent hover:text-accent relative z-10 inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold transition-colors"
                          href={`/studio/${project.id}`}
                        >
                          Open in studio
                        </IntentPrefetchLink>
                      ) : null}
                    </div>
                  </article>
                </Reveal>
              ))}
            </ul>
            {nextCursor && (
              <div className="mt-8 text-center">
                <ButtonLink
                  variant="secondary"
                  href={`/projects?scope=${scope}${review ? "&review=1" : ""}&after=${encodeURIComponent(nextCursor)}`}
                  prefetch={false}
                >
                  Next projects
                </ButtonLink>
              </div>
            )}
          </section>
        ) : (
          <section className="rounded-card border-strong mt-6 border border-dashed p-8 text-center sm:p-12">
            <p className="text-accent font-mono text-xs uppercase">
              {currentScope === "all" ? "Your first project" : "Nothing here"}
            </p>
            <h2 className="mt-3 text-2xl font-semibold">
              {currentScope === "review"
                ? "No contributions are waiting on you."
                : "Start with a musical idea and a few MIDI patterns."}
            </h2>
            <p className="text-muted mx-auto mt-3 max-w-xl leading-7">
              Projects keep your private arrangement workspace, published
              revision history, and pattern lineage together.
            </p>
            <div className="mt-6">
              <ButtonLink href="/projects/new" prefetch={false}>
                Create your first project
              </ButtonLink>
            </div>
          </section>
        )}
      </Container>
    </main>
  );
}
