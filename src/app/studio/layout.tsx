import { randomUUID } from "node:crypto";
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
    <main
      id="main-content"
      className="flex min-h-[calc(100vh-4.5rem)] flex-col gap-3 px-3 py-3 sm:px-4"
    >
      <StudioShell
        initialProjects={initialProjects}
        projectOptions={projectOptions}
        createAction={createAction}
      >
        {children}
      </StudioShell>
    </main>
  );
}
