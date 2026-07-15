import { randomUUID } from "node:crypto";
import { Container } from "@/components/layout/container";
import { getOptionalViewer } from "@/features/auth/guards";
import { createProjectAction } from "@/features/projects/actions";
import { StudioShell } from "@/features/studio/components/studio-shell.client";
import {
  listProjectFormOptions,
  listProjectsForViewer,
} from "@/server/repositories/projects";

export default async function StudioLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const viewer = await getOptionalViewer();
  const ready = viewer?.status === "active" && viewer.profileCompletedAt;
  const [initialProjects, projectOptions] = ready
    ? await Promise.all([
        listProjectsForViewer(viewer.id),
        listProjectFormOptions(),
      ])
    : [null, null];
  const createAction = ready
    ? createProjectAction.bind(null, randomUUID())
    : null;

  return (
    <main id="main-content">
      <Container className="py-8 sm:py-10">
        <div className="mx-auto max-w-6xl space-y-8">
          <StudioShell
            initialProjects={initialProjects}
            projectOptions={projectOptions}
            createAction={createAction}
          >
            {children}
          </StudioShell>
        </div>
      </Container>
    </main>
  );
}
