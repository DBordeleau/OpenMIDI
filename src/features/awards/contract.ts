import { z } from "zod";

export const awardBasisSchema = z.enum([
  "official_winner",
  "community_favorite",
  "top_placement",
]);

export const publicProfileAwardSchema = z
  .object({
    id: z.uuid(),
    badgeDefinitionVersionId: z.uuid(),
    badgeCode: z.enum([
      "challenge-winner",
      "community-favorite",
      "top-placement",
    ]),
    badgeName: z.string().trim().min(1).max(80),
    badgeDescription: z.string().trim().min(1).max(240),
    earnedMessage: z.string().trim().min(1).max(240),
    presentationCode: z.enum(["trophy", "favorite", "placement"]),
    awardBasis: awardBasisSchema,
    place: z.number().int().min(1).max(20).nullable(),
    placementLabel: z.string().trim().min(1).max(80).nullable(),
    awardedAt: z.iso.datetime({ offset: true }),
    challengeSlug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .min(3)
      .max(80),
    challengeTitle: z.string().trim().min(1).max(120),
    challengeResultId: z.uuid(),
    challengeEntryId: z.uuid(),
    projectRevisionId: z.uuid(),
    projectTitle: z.string().trim().min(1).max(120),
    revisionNumber: z.number().int().positive(),
    challengeHref: z.string().max(300),
  })
  .strict()
  .superRefine((award, context) => {
    const exactHref = `/challenges/${award.challengeSlug}?result=${award.challengeResultId}&entry=${award.challengeEntryId}#entry-${award.challengeEntryId}`;
    if (award.challengeHref !== exactHref)
      context.addIssue({
        code: "custom",
        path: ["challengeHref"],
        message: "Award source must use the canonical exact-result link.",
      });
    if (
      (award.awardBasis === "official_winner" &&
        (award.place !== 1 || award.placementLabel === null)) ||
      (award.awardBasis === "top_placement" &&
        ((award.place ?? 0) < 2 || award.placementLabel === null)) ||
      (award.awardBasis === "community_favorite" &&
        (award.place !== null || award.placementLabel !== null))
    )
      context.addIssue({
        code: "custom",
        path: ["awardBasis"],
        message: "Award basis and placement do not match.",
      });
  });

export type PublicProfileAward = z.infer<typeof publicProfileAwardSchema>;
