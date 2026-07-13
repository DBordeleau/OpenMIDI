import { z } from "zod";

export const forkProjectInputSchema = z.object({
  sourceProjectId: z.string().uuid(),
  sourceRevisionId: z.string().uuid(),
  requestId: z.string().uuid(),
  expectedLicenseCode: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1, "Enter a title.").max(120),
  description: z
    .string()
    .trim()
    .max(5000)
    .transform((value) => value || null),
});

export type ForkProjectInput = z.infer<typeof forkProjectInputSchema>;

export function defaultForkTitle(sourceTitle: string): string {
  const prefixed = `Fork of ${sourceTitle}`;
  if (Array.from(prefixed).length <= 120) return prefixed;
  const suffix = " (fork)";
  return `${Array.from(sourceTitle)
    .slice(0, 120 - suffix.length)
    .join("")}${suffix}`;
}
