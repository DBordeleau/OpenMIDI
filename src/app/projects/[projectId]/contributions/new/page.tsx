import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { requireViewer } from "@/features/auth/guards";
import { CreateContributionForm } from "@/features/contributions/create-contribution-form";
import { projectIdSchema } from "@/features/projects/schema";
import { getProjectForViewer } from "@/server/repositories/projects";

export default async function NewContributionPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  if (!projectIdSchema.safeParse(projectId).success) notFound();
  await requireViewer("/projects/" + projectId + "/contributions/new");
  const project = await getProjectForViewer(projectId);
  if (
    !project ||
    project.viewerRole === "owner" ||
    project.status !== "active" ||
    !project.openToContributions ||
    !project.currentRevisionId
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
          <p className="text-accent mt-6 font-semibold">Private contribution</p>
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
            <a className="underline" href={project.license.url}>
              {project.license.name}
            </a>
            .
          </p>
          <CreateContributionForm
            projectId={projectId}
            currentRevisionId={project.currentRevisionId}
          />
        </div>
      </Container>
    </main>
  );
}
