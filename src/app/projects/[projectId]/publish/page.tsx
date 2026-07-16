import { notFound, redirect } from "next/navigation";
import { requireViewer } from "@/features/auth/guards";
import { projectIdSchema } from "@/features/projects/schema";

export default async function PublishPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireViewer(`/projects/${projectId}/publish`);
  if (!projectIdSchema.safeParse(projectId).success) notFound();
  redirect(`/studio/${projectId}`);
}
