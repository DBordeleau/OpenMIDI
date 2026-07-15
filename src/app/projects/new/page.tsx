import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { Reveal } from "@/components/ui/reveal.client";
import { requireViewer } from "@/features/auth/guards";
import { createProjectAction } from "@/features/projects/actions";
import { ProjectForm } from "@/features/projects/project-form";
import { listProjectFormOptions } from "@/server/repositories/projects";
export default async function NewProjectPage() {
  const viewer = await requireViewer("/projects/new");
  if (!viewer.profileCompletedAt) redirect("/onboarding");
  const options = await listProjectFormOptions();
  const action = createProjectAction.bind(null, randomUUID());
  return (
    <main id="main-content">
      <Container className="py-16">
        <section className="mx-auto max-w-3xl">
          <Reveal>
            <p className="text-accent-2 font-mono text-xs font-semibold tracking-[0.2em] uppercase">
              Private draft
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-[-0.02em]">
              Create a project
            </h1>
            <p className="text-muted mt-3">
              Set the musical context, then bring an exact version from My stems
              into your new private Studio workspace.
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <ProjectForm action={action} options={options} />
          </Reveal>
        </section>
      </Container>
    </main>
  );
}
