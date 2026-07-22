"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { profileSchema } from "./schema";
import {
  avatarResetInputSchema,
  avatarSaveInputSchema,
  type AvatarConfigV1,
} from "./avatar/contract";
import {
  getViewerProfile,
  resetViewerAvatarConfig,
  saveViewerAvatarConfig,
  saveViewerProfile,
} from "@/server/repositories/profiles";

export type ProfileFormState = {
  message?: string;
  fields?: Record<string, string[]>;
};

export type AvatarActionResult =
  | {
      ok: true;
      avatarConfig: AvatarConfigV1 | null;
      avatarConfigRevision: number;
    }
  | {
      ok: false;
      kind: "invalid" | "stale" | "forbidden" | "unavailable";
      message: string;
    };

function avatarActionError(code: string): AvatarActionResult {
  if (code === "PT409")
    return {
      ok: false,
      kind: "stale",
      message:
        "Your avatar changed in another tab. Refresh this page, then try again.",
    };
  if (code === "PT400")
    return {
      ok: false,
      kind: "invalid",
      message: "One of those avatar choices is no longer valid.",
    };
  if (code === "PT401" || code === "PT403")
    return {
      ok: false,
      kind: "forbidden",
      message: "Your account can't change this avatar right now.",
    };
  return {
    ok: false,
    kind: "unavailable",
    message: "We couldn't save your avatar. Please try again.",
  };
}

function revalidateAvatarPaths(username: string | null) {
  revalidatePath("/settings/avatar");
  revalidatePath("/settings/profile");
  if (username) revalidatePath(`/@${username}`);
  revalidatePath("/", "layout");
}

export async function saveAvatarAction(
  input: unknown,
): Promise<AvatarActionResult> {
  const parsed = avatarSaveInputSchema.safeParse(input);
  if (!parsed.success) return avatarActionError("PT400");
  try {
    const viewer = await getViewerProfile();
    const result = await saveViewerAvatarConfig(parsed.data);
    if (result.error) return avatarActionError(result.error.code);
    revalidateAvatarPaths(viewer?.username ?? null);
    return { ok: true, ...result.data };
  } catch {
    return avatarActionError("unavailable");
  }
}

export async function resetAvatarAction(
  input: unknown,
): Promise<AvatarActionResult> {
  const parsed = avatarResetInputSchema.safeParse(input);
  if (!parsed.success) return avatarActionError("PT400");
  try {
    const viewer = await getViewerProfile();
    const result = await resetViewerAvatarConfig(parsed.data);
    if (result.error) return avatarActionError(result.error.code);
    revalidateAvatarPaths(viewer?.username ?? null);
    return { ok: true, ...result.data };
  } catch {
    return avatarActionError("unavailable");
  }
}

export async function saveProfileAction(
  _state: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const parsed = profileSchema.safeParse({
    username: formData.get("username"),
    displayName: formData.get("displayName"),
    creditName: formData.get("creditName"),
    bio: formData.get("bio") ?? "",
  });
  if (!parsed.success)
    return {
      message: "Check the highlighted fields.",
      fields: parsed.error.flatten().fieldErrors,
    };
  const { data, error } = await saveViewerProfile(parsed.data);
  if (error) {
    const message = error.message;
    if (error.code === "PT409" || message === "username_unavailable")
      return {
        message: "That username is unavailable.",
        fields: { username: ["Choose another username."] },
      };
    if (error.code === "PT412")
      return { message: "Your username cannot be changed." };
    if (error.code === "PT403") redirect("/account-unavailable");
    return { message: "We couldn’t save your profile. Please try again." };
  }
  const saved = data[0];
  if (saved?.username) revalidatePath(`/@${saved.username}`);
  revalidatePath("/settings/profile");
  const returnTo =
    formData.get("returnTo") === "/dashboard"
      ? "/dashboard"
      : "/settings/profile?saved=1";
  revalidatePath(returnTo);
  redirect(returnTo);
}
