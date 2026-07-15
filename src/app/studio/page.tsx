import { requireViewer } from "@/features/auth/guards";
import { BlankStudioWorkspace } from "@/features/studio/components/blank-studio-workspace";

export default async function StudioStartPage() {
  await requireViewer("/studio");

  return <BlankStudioWorkspace />;
}
