"use server";

import {
  activateSignupInvitation,
  InvitationRepositoryError,
  type SignupInvitationActivation,
} from "@/server/repositories/invitations";
import { adminInviteSchema } from "./schema";

export type AdminInviteActionState =
  | { status: "idle" }
  | {
      status: "success";
      email: string;
      outcome: SignupInvitationActivation["status"];
      message: string;
    }
  | { status: "error"; message: string };

export async function activateSignupInvitationAction(
  _state: AdminInviteActionState,
  formData: FormData,
): Promise<AdminInviteActionState> {
  const parsed = adminInviteSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success)
    return { status: "error", message: "Enter a complete email address." };

  try {
    const result = await activateSignupInvitation(parsed.data.email);
    return {
      status: "success",
      email: result.email,
      outcome: result.status,
      message:
        result.status === "already_active"
          ? "Theyâ€™re already on the beta list."
          : `Theyâ€™re on the list. ${result.email} can now sign in with Google.`,
    };
  } catch (error) {
    if (
      error instanceof InvitationRepositoryError &&
      error.reason === "invalid"
    )
      return { status: "error", message: "Enter a complete email address." };
    return {
      status: "error",
      message: "That invite didnâ€™t save. Try again.",
    };
  }
}
