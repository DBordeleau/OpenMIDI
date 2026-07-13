"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import {
  PUBLIC_PROJECTS_CACHE_TAG,
  publicProjectCacheTag,
} from "@/lib/cache/public-projects";
import { setProjectVisibility } from "@/server/repositories/projects";

export type ProjectVisibilityState = { message?: string };

export async function setProjectVisibilityAction(
  projectId: string,
  expectedLockVersion: number,
  visibility: "private" | "public",
  _state: ProjectVisibilityState,
): Promise<ProjectVisibilityState> {
  void _state;
  const parsed = z
    .object({
      projectId: z.string().uuid(),
      expectedLockVersion: z.number().int().positive(),
      visibility: z.enum(["private", "public"]),
    })
    .safeParse({ projectId, expectedLockVersion, visibility });
  if (!parsed.success) return { message: "That visibility change is invalid." };
  const { error } = await setProjectVisibility(parsed.data);
  if (error)
    return {
      message:
        error.code === "PT409"
          ? "The project changed in another session. Reload before changing visibility."
          : "We couldn’t update this project’s visibility.",
    };
  updateTag(PUBLIC_PROJECTS_CACHE_TAG);
  updateTag(publicProjectCacheTag(projectId));
  revalidatePath("/explore");
  revalidatePath(`/projects/${projectId}`);
  return {};
}
