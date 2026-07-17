"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { projectInputSchema } from "./schema";
import { updateProjectMetadata } from "@/server/repositories/projects";
import { createMidiProjectWorkspaceV3 } from "@/server/repositories/midi-v3";

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
  if (parsed.data.bpm === null || parsed.data.bpm > 300)
    return {
      message: "Set a project tempo between 20 and 300 BPM.",
      fields: { bpm: ["MIDI projects require a tempo from 20 to 300 BPM."] },
    };
  try {
    const created = await createMidiProjectWorkspaceV3({
      requestId,
      title: parsed.data.title,
      description: parsed.data.description ?? "",
      tempoBpm: parsed.data.bpm,
      musicalKey: parsed.data.musicalKey,
      timeSignatureNumerator: parsed.data.timeSignatureNumerator,
      timeSignatureDenominator: parsed.data.timeSignatureDenominator,
      licenseCode: parsed.data.licenseCode,
      genreIds: parsed.data.genreIds,
      primaryGenreId: parsed.data.primaryGenreId,
      tagIds: parsed.data.tagIds,
    });
    revalidatePath("/studio", "layout");
    redirect(`/studio/${created.project_id}`);
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT"))
      throw error;
    return {
      message: "We couldn’t create the MIDI project. Please try again.",
    };
  }
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
