import { redirect } from "next/navigation";
import { requireViewer } from "@/features/auth/guards";

export default async function UploadsPage() {
  await requireViewer("/uploads");
  redirect("/studio");
}
