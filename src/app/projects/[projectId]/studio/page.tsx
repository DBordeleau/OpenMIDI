import { redirect } from "next/navigation";

export default async function LegacyStudioPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/studio/${projectId}`);
}
