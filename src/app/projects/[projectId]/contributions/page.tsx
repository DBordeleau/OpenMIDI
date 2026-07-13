import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { requireViewer } from "@/features/auth/guards";
import { ContributionList } from "@/features/contributions/contribution-list";
import { projectIdSchema } from "@/features/projects/schema";
import {
  listContributionsByAuthor,
  listContributionsForOwnerReview,
} from "@/server/repositories/contributions";
import { getProjectForViewer } from "@/server/repositories/projects";

export default async function ProjectContributionsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  if (!projectIdSchema.safeParse(projectId).success) notFound();
  await requireViewer("/projects/" + projectId + "/contributions");
  const project = await getProjectForViewer(projectId);
  if (!project) notFound();
  const contributions =
    project.viewerRole === "owner"
      ? await listContributionsForOwnerReview(projectId)
      : await listContributionsByAuthor();
  const visible = contributions.filter((item) => item.projectId === projectId);
  return (
    <main id="main-content">
      <Container className="py-12">
        <Link className="text-accent underline" href={"/projects/" + projectId}>
          Return to project
        </Link>
        <h1 className="mt-6 text-4xl font-bold">
          Contributions to {project.title}
        </h1>
        <p className="text-muted mt-3">
          {project.viewerRole === "owner"
            ? "Only proposals with immutable submitted history are visible to the project owner."
            : "Your private draft and immutable submitted versions are visible here."}
        </p>
        <ContributionList contributions={visible} />
      </Container>
    </main>
  );
}
