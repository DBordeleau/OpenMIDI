"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { forkProjectInputSchema } from "./schema";
import { forkProject } from "@/server/repositories/forks";

export type ForkProjectState = { message?: string };

export async function forkProjectAction(
  sourceProjectId: string,
  sourceRevisionId: string,
  expectedLicenseCode: string,
  _state: ForkProjectState,
  formData: FormData,
): Promise<ForkProjectState> {
  const parsed = forkProjectInputSchema.safeParse({
    sourceProjectId,
    sourceRevisionId,
    expectedLicenseCode,
    rightsAttestationVersion: formData.get("rightsAttestationVersion"),
    attested: formData.get("attested") === "on",
    requestId: formData.get("requestId"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success)
    return { message: "Check the title and description, then try again." };

  const { data, error } = await forkProject(parsed.data);
  const result = data?.[0];
  if (error || !result) {
    const message = error?.message;
    return {
      message:
        message === "fork_license_unavailable" ||
        message === "fork_source_not_found"
          ? "This project’s license no longer permits a fork. Reload to review it."
          : error?.code === "PT404"
            ? "The source revision is no longer available to fork."
            : error?.code === "PT409"
              ? "The source or this fork request changed. Reload before trying again."
              : "We couldn’t create this fork. Please try again.",
    };
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${sourceProjectId}`);
  redirect(`/projects/${result.project_id}?forked=1`);
}
