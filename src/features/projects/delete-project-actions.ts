"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import {
  PUBLIC_PROJECTS_CACHE_TAG,
  publicProjectCacheTag,
} from "@/lib/cache/public-projects";
import { deleteProjectSchema } from "./schema";
import { deleteProject } from "@/server/repositories/projects";

export type DeleteProjectState = { message?: string };

export async function deleteProjectAction(
  projectId: string,
  expectedLockVersion: number,
  _state: DeleteProjectState,
  formData: FormData,
): Promise<DeleteProjectState> {
  void _state;
  const parsed = deleteProjectSchema.safeParse({
    projectId,
    expectedLockVersion,
    requestId: formData.get("requestId"),
  });
  if (!parsed.success) return { message: "That deletion request is invalid." };

  const { error } = await deleteProject(parsed.data);
  if (error) {
    if (error.code === "PT409")
      return {
        message:
          "The project changed in another session. Reload before deleting it.",
      };
    if (error.code === "PT404")
      return { message: "Only the project owner can delete this project." };
    return { message: "We couldn’t delete this project. Please try again." };
  }

  updateTag(PUBLIC_PROJECTS_CACHE_TAG);
  updateTag(publicProjectCacheTag(projectId));
  revalidatePath("/explore");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  redirect("/projects?deleted=1");
}
