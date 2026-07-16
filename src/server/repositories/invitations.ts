import "server-only";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const activationResultSchema = z.object({
  email: z.string().email().max(254),
  status: z.enum(["activated", "already_active", "reactivated"]),
});

export type SignupInvitationActivation = z.infer<typeof activationResultSchema>;
export type InvitationFailure = "invalid" | "unauthorized" | "unavailable";

export class InvitationRepositoryError extends Error {
  constructor(readonly reason: InvitationFailure) {
    super(`invitation_${reason}`);
    this.name = "InvitationRepositoryError";
  }
}

export function parseSignupInvitationActivation(value: unknown) {
  return activationResultSchema.parse(value);
}

export async function activateSignupInvitation(
  email: string,
): Promise<SignupInvitationActivation> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("activate_signup_invitation", {
    p_email: email,
  });
  if (error) {
    if (error.code === "PT400") throw new InvitationRepositoryError("invalid");
    if (error.code === "PT401" || error.code === "PT404")
      throw new InvitationRepositoryError("unauthorized");
    throw new InvitationRepositoryError("unavailable");
  }
  try {
    return parseSignupInvitationActivation(data);
  } catch {
    throw new InvitationRepositoryError("unavailable");
  }
}
