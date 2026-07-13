import { z } from "zod";

export const profileSchema = z.object({
  username: z
    .string()
    .regex(
      /^[A-Za-z0-9_]{3,30}$/,
      "Use 3–30 letters, numbers, or underscores.",
    ),
  displayName: z.string().trim().min(1, "Enter a display name.").max(80),
  creditName: z.string().trim().min(1, "Enter a credit name.").max(120),
  bio: z
    .string()
    .trim()
    .max(500)
    .transform((value) => value || null),
});

export type ProfileInput = z.infer<typeof profileSchema>;
