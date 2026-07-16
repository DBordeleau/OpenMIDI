import { z } from "zod";

export const FORK_RIGHTS_ATTESTATION_VERSION =
  "cc-by-4.0-reuse-attestation-v1" as const;
export const FORK_RIGHTS_ATTESTATION_TEXT =
  "I will preserve CC BY 4.0 attribution and source lineage for the MIDI patterns reused by this fork.";

export const forkProjectInputSchema = z.object({
  sourceProjectId: z.string().uuid(),
  sourceRevisionId: z.string().uuid(),
  requestId: z.string().uuid(),
  expectedLicenseCode: z.literal("cc-by-4.0"),
  rightsAttestationVersion: z.literal(FORK_RIGHTS_ATTESTATION_VERSION),
  attested: z.literal(true),
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
