import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { requireViewer } from "@/features/auth/guards";
import { CreateContributionForm } from "@/features/contributions/create-contribution-form";
import { projectIdSchema } from "@/features/projects/schema";
import { getProjectForViewer } from "@/server/repositories/projects";
import { getPublicProject } from "@/server/repositories/public-projects";

export default async function NewContributionPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  if (!projectIdSchema.safeParse(projectId).success) notFound();
  const viewer = await requireViewer(
    "/projects/" + projectId + "/contributions/new",
  );
  if (!viewer.profileCompletedAt) redirect("/onboarding");
  const memberProject = await getProjectForViewer(projectId);
  const publicProject = memberProject
    ? null
    : await getPublicProject(projectId);
  const project = memberProject
    ? {
        title: memberProject.title,
        owner: memberProject.viewerRole === "owner",
        active: memberProject.status === "active",
        open: memberProject.openToContributions,
        currentRevisionId: memberProject.currentRevisionId,
        license: memberProject.license,
        visibility: memberProject.visibility,
      }
    : publicProject
      ? {
          title: publicProject.title,
          owner: false,
          active: true,
          open: publicProject.openToContributions,
          currentRevisionId: publicProject.currentRevisionId,
          license: publicProject.license,
          visibility: "public" as const,
        }
      : null;
  if (
    !project ||
    project.owner ||
    !project.active ||
    !project.open ||
    !project.currentRevisionId ||
    project.license.code !== "cc-by-4.0"
  )
    notFound();
  return (
    <main id="main-content">
      <Container className="py-12">
        <div className="mx-auto max-w-2xl">
          <Link
            className="text-accent underline"
            href={"/projects/" + projectId}
          >
            Return to project
          </Link>
          <p className="text-accent mt-6 font-semibold">
            Private contribution workspace
          </p>
          <h1 className="mt-2 text-4xl font-bold">
            Propose changes to {project.title}
          </h1>
          <p className="text-muted mt-3">
            Your workspace starts from the exact current revision{" "}
            <span className="font-mono text-sm">
              {project.currentRevisionId}
            </span>
            . It does not change published history.
          </p>
          <p className="text-muted mt-3">
            Displayed license:{" "}
            {project.license.url ? (
              <a className="underline" href={project.license.url}>
                {project.license.name}
              </a>
            ) : (
              project.license.name
            )}
            .
          </p>
          <CreateContributionForm
            projectId={projectId}
            currentRevisionId={project.currentRevisionId}
            expectedLicenseCode="cc-by-4.0"
          />
        </div>
      </Container>
    </main>
  );
}
