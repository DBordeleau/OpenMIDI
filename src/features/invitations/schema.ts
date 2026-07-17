import { z } from "zod";

export const adminInviteSchema = z.object({
  email: z
    .string()
    .trim()
    .max(254, "Enter an email address with 254 characters or fewer.")
    .email("Enter a complete email address."),
});

export type AdminInviteInput = z.infer<typeof adminInviteSchema>;
