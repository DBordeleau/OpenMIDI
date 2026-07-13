import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button";
import { requireViewer } from "@/features/auth/guards";
import { listProjectsForViewer } from "@/server/repositories/projects";

export const metadata: Metadata = { title: "My projects" };

const statusLabels = {
  active: "Active",
  archived: "Archived",
  draft: "Draft",
} as const;

export default async function ProjectsPage() {
  const viewer = await requireViewer("/projects");
  const projects = await listProjectsForViewer(viewer.id);

  return (
    <main id="main-content">
      <Container className="py-12 sm:py-16">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-accent font-mono text-xs font-semibold tracking-[0.18em] uppercase">
              Your music workspace
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              My projects
            </h1>
            <p className="text-muted mt-3 max-w-2xl text-lg">
              Open a project, continue its latest arrangement, or start
              something new.
            </p>
          </div>
          <ButtonLink href="/projects/new">New project</ButtonLink>
        </div>

        {projects.length > 0 ? (
          <section className="mt-10" aria-labelledby="project-list-heading">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 id="project-list-heading" className="text-xl font-semibold">
                Recent projects
              </h2>
              <p className="text-muted text-sm">
                {projects.length}{" "}
                {projects.length === 1 ? "project" : "projects"}
              </p>
            </div>
            <ul className="grid gap-4 lg:grid-cols-2">
              {projects.map((project) => (
                <li
                  key={project.id}
                  className="rounded-card border-subtle bg-surface shadow-raised flex min-h-64 flex-col border p-6"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide uppercase">
                    <span className="text-accent">
                      {statusLabels[project.status]}
                    </span>
                    <span aria-hidden="true" className="text-muted">
                      /
                    </span>
                    <span className="text-muted capitalize">
                      {project.role}
                    </span>
                    {project.currentRevisionId && (
                      <>
                        <span aria-hidden="true" className="text-muted">
                          /
                        </span>
                        <span className="text-muted">Published</span>
                      </>
                    )}
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight">
                    <Link
                      className="hover:text-accent transition-colors"
                      href={`/projects/${project.id}`}
                    >
                      {project.title}
                    </Link>
                  </h3>
                  <p className="text-muted mt-3 line-clamp-3 leading-7">
                    {project.description ||
                      "No description yet. Add context so collaborators understand the direction."}
                  </p>
                  <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-7">
                    <p className="text-muted text-sm">
                      Updated{" "}
                      <time dateTime={project.updatedAt}>
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </time>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        className="rounded-control border-strong hover:border-accent hover:text-accent inline-flex min-h-11 items-center border px-4 py-2 text-sm font-semibold transition-colors"
                        href={`/projects/${project.id}`}
                      >
                        Open project
                      </Link>
                      {project.currentRevisionId ? (
                        <Link
                          className="rounded-control bg-accent hover:bg-accent-strong inline-flex min-h-11 items-center px-4 py-2 text-sm font-semibold text-slate-950 transition-colors"
                          href={`/projects/${project.id}/studio`}
                        >
                          Open studio
                        </Link>
                      ) : project.role === "owner" ? (
                        <Link
                          className="rounded-control bg-accent hover:bg-accent-strong inline-flex min-h-11 items-center px-4 py-2 text-sm font-semibold text-slate-950 transition-colors"
                          href={`/projects/${project.id}/publish`}
                        >
                          Publish stems
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="rounded-card border-strong bg-surface mt-10 border border-dashed p-8 text-center sm:p-12">
            <p className="text-accent font-mono text-xs uppercase">
              Your first project
            </p>
            <h2 className="mt-3 text-2xl font-semibold">
              Start with a musical idea and a few stems.
            </h2>
            <p className="text-muted mx-auto mt-3 max-w-xl leading-7">
              Projects keep your source audio, private workspace, and published
              revision history together.
            </p>
            <div className="mt-6">
              <ButtonLink href="/projects/new">
                Create your first project
              </ButtonLink>
            </div>
          </section>
        )}
      </Container>
    </main>
  );
}
