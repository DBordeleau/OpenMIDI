"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { projectInputSchema } from "./schema";
import {
  createProject,
  updateProjectMetadata,
} from "@/server/repositories/projects";

export type ProjectFormState = {
  message?: string;
  fields?: Record<string, string[]>;
};
function parse(formData: FormData) {
  return projectInputSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    bpm: formData.get("bpm") ?? "",
    musicalKey: formData.get("musicalKey") ?? "",
    timeSignatureNumerator: formData.get("timeSignatureNumerator"),
    timeSignatureDenominator: formData.get("timeSignatureDenominator"),
    licenseCode: formData.get("licenseCode"),
    genreIds: formData.getAll("genreIds"),
    primaryGenreId: formData.get("primaryGenreId") ?? "",
    tagIds: formData.getAll("tagIds"),
  });
}
export async function createProjectAction(
  requestId: string,
  _state: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const parsed = parse(formData);
  if (!parsed.success)
    return {
      message: "Check the highlighted fields.",
      fields: parsed.error.flatten().fieldErrors,
    };
  const { data, error } = await createProject(parsed.data, requestId);
  if (error || !data[0])
    return {
      message:
        error?.code === "PT409"
          ? "This creation request was already used with different details."
          : "We couldn’t create the project. Please try again.",
    };
  redirect(`/studio/${data[0].project_id}`);
}
export async function updateProjectAction(
  projectId: string,
  lockVersion: number,
  _state: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const parsed = parse(formData);
  if (!parsed.success)
    return {
      message: "Check the highlighted fields.",
      fields: parsed.error.flatten().fieldErrors,
    };
  const { error } = await updateProjectMetadata(
    projectId,
    lockVersion,
    parsed.data,
  );
  if (error)
    return {
      message:
        error.code === "PT409"
          ? "This project changed in another session. Reload to review the latest version."
          : "We couldn’t save the project. Please try again.",
    };
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?saved=1`);
}
