"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createContributionSchema,
  submitContributionSchema,
  withdrawContributionSchema,
} from "./schema";
import {
  createContributionWorkspace,
  setProjectContributionsOpen,
  submitContribution,
  withdrawContribution,
} from "@/server/repositories/contributions";

export type ContributionActionState = { message?: string };

export async function createContributionAction(
  projectId: string,
  _state: ContributionActionState,
  formData: FormData,
): Promise<ContributionActionState> {
  const parsed = createContributionSchema.safeParse({
    requestId: formData.get("requestId"),
    expectedCurrentRevisionId: formData.get("expectedCurrentRevisionId"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { message: "Check the contribution details." };
  const { data, error } = await createContributionWorkspace({
    projectId,
    ...parsed.data,
  });
  if (error || !data?.[0])
    return {
      message:
        error?.message === "contribution_base_changed"
          ? "The project revision changed. Reload before starting."
          : error?.message === "contribution_live_exists"
            ? "You already have a live contribution or workspace for this project."
            : "This contribution could not be created. Confirm submissions are open and try again.",
    };
  revalidatePath("/contributions");
  redirect(`/projects/${projectId}/contributions/${data[0].contribution_id}`);
}

export async function submitContributionAction(
  projectId: string,
  input: unknown,
) {
  const parsed = submitContributionSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, code: "invalid_request" as const };
  const { data, error } = await submitContribution({
    contributionId: parsed.data.contributionId,
    requestId: parsed.data.requestId,
    expectedWorkspaceLockVersion: parsed.data.expectedWorkspaceLockVersion,
    expectedBaseRevisionId: parsed.data.expectedBaseRevisionId,
    expectedManifestSha256: parsed.data.expectedManifestSha256,
    attestationVersion: parsed.data.attestationVersion,
  });
  if (error || !data?.[0]) {
    const message = error?.message;
    return {
      ok: false as const,
      code:
        message === "contribution_base_changed"
          ? ("stale_base" as const)
          : message === "contribution_workspace_stale"
            ? ("unsaved" as const)
            : message === "contribution_submissions_closed"
              ? ("closed" as const)
              : error?.code === "PT409"
                ? ("conflict" as const)
                : ("unavailable" as const),
    };
  }
  revalidatePath("/contributions");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/contributions`);
  revalidatePath(
    `/projects/${projectId}/contributions/${parsed.data.contributionId}`,
  );
  revalidatePath(`/projects/${projectId}/studio`);
  return { ok: true as const, versionNumber: data[0].version_number };
}

export async function withdrawContributionAction(
  projectId: string,
  input: unknown,
) {
  const parsed = withdrawContributionSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, code: "invalid_request" as const };
  const { error } = await withdrawContribution(parsed.data);
  if (error)
    return {
      ok: false as const,
      code:
        error.code === "PT409"
          ? ("conflict" as const)
          : ("unavailable" as const),
    };
  revalidatePath("/contributions");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/contributions`);
  revalidatePath(
    `/projects/${projectId}/contributions/${parsed.data.contributionId}`,
  );
  revalidatePath(`/projects/${projectId}/studio`);
  return { ok: true as const };
}

export async function setProjectContributionsOpenAction(
  projectId: string,
  expectedLockVersion: number,
  open: boolean,
  _state: ContributionActionState,
): Promise<ContributionActionState> {
  void _state;
  const { error } = await setProjectContributionsOpen({
    projectId,
    expectedLockVersion,
    open,
  });
  if (error)
    return {
      message:
        error.code === "PT409"
          ? "The project changed. Reload before changing submissions."
          : "We couldnâ€™t update the submission setting.",
    };
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/contributions`);
  return {};
}
