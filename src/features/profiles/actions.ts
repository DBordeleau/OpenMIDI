"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { profileSchema } from "./schema";
import { saveViewerProfile } from "@/server/repositories/profiles";

export type ProfileFormState = {
  message?: string;
  fields?: Record<string, string[]>;
};

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
  redirect("/settings/profile?saved=1");
}
