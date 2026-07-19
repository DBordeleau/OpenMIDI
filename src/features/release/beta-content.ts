import { z } from "zod";
import { patternContentV3Schema } from "@/features/midi/domain-v3";
import { challengeConstraintsV1Schema } from "@/features/challenges/constraint-v1";
import { musicalKeys } from "@/features/projects/schema";
import rawFixture from "./release-02-beta-content.json";

const uuid = z.uuid();
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);

const trackSchema = z
  .object({
    trackId: uuid,
    clipId: uuid,
    patternKey: z.string().min(1),
    name: z.string().trim().min(1).max(120),
    presetId: z.string().trim().min(1).max(64),
    gainDb: z.number().min(-60).max(6),
    pan: z.number().min(-1).max(1),
  })
  .strict();

const projectSchema = z
  .object({
    key: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    requestId: uuid,
    saveRequestId: uuid,
    publishRequestId: uuid,
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(5000),
    tempoBpm: z.number().min(20).max(300),
    musicalKey: z.enum(musicalKeys),
    timeSignature: z
      .object({
        numerator: z.number().int().min(1).max(32),
        denominator: z.union([
          z.literal(1),
          z.literal(2),
          z.literal(4),
          z.literal(8),
          z.literal(16),
          z.literal(32),
        ]),
      })
      .strict(),
    durationTicks: z.number().int().positive(),
    licenseCode: z.enum(["cc-by-4.0", "all-rights-reserved"]),
    genreIds: z.array(uuid).max(3),
    primaryGenreId: uuid,
    tagIds: z.array(uuid).max(10),
    revisionMessage: z.string().trim().min(1).max(500),
    tracks: z.array(trackSchema).min(1).max(16),
  })
  .strict();

const patternSchema = z
  .object({
    key: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    projectKey: z.string().min(1),
    requestId: uuid,
    versionRequestId: uuid,
    listingRequestId: uuid,
    name: z.string().trim().min(1).max(120),
    durationTicks: z.number().int().positive(),
    expectedContentSha256: sha256,
    reuseMode: z.enum(["commercial_reuse", "reference_only"]),
    categoryCode: z.enum([
      "melody",
      "harmony",
      "bassline",
      "rhythm",
      "drums",
      "texture",
    ]),
    suggestedPresetId: z.string().trim().min(1).max(64),
    tags: z.array(z.string().min(1)).max(8),
    description: z.string().trim().min(1).max(1000),
    notes: patternContentV3Schema.shape.notes,
  })
  .strict();

const challengeSchema = z
  .object({
    requestId: uuid,
    publishRequestId: uuid,
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().trim().min(1).max(120),
    prompt: z.string().trim().min(1).max(500),
    description: z.string().trim().min(1).max(5000),
    eligibilityTerms: z.string().trim().min(1).max(2000),
    presentationCode: z.enum(["pulse", "nocturne", "sunrise"]),
    opensAt: z.iso.datetime(),
    submissionsCloseAt: z.iso.datetime(),
    votingOpensAt: z.iso.datetime(),
    votingClosesAt: z.iso.datetime(),
    resultsExpectedAt: z.iso.datetime(),
    judgingMode: z.enum(["community", "judged", "hybrid"]),
    officialPlacementCount: z.number().int().min(0).max(20),
    expectedConstraintsSha256: sha256,
    constraints: challengeConstraintsV1Schema,
    judges: z
      .array(
        z
          .object({
            role: z.enum(["host", "judge"]),
            displayName: z.string().trim().min(1).max(120),
            profileId: uuid.nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(10),
  })
  .strict();

const betaContentSchema = z
  .object({
    fixtureVersion: z.literal(1),
    rightsReview: z
      .object({
        reviewedAt: z.iso.date(),
        basis: z.string().trim().min(1),
      })
      .strict(),
    projects: z.array(projectSchema).min(3),
    patterns: z.array(patternSchema).min(4),
    challenge: challengeSchema,
  })
  .strict()
  .superRefine((fixture, context) => {
    const projectKeys = new Set(fixture.projects.map(({ key }) => key));
    const patternKeys = new Set(fixture.patterns.map(({ key }) => key));
    const patternsByKey = new Map(
      fixture.patterns.map((pattern) => [pattern.key, pattern]),
    );
    for (const pattern of fixture.patterns) {
      if (!projectKeys.has(pattern.projectKey)) {
        context.addIssue({
          code: "custom",
          message: `Unknown projectKey ${pattern.projectKey}`,
        });
      }
    }
    for (const [projectIndex, project] of fixture.projects.entries()) {
      for (const [trackIndex, track] of project.tracks.entries()) {
        if (!patternKeys.has(track.patternKey)) {
          context.addIssue({
            code: "custom",
            message: `Unknown patternKey ${track.patternKey}`,
          });
          continue;
        }
        const pattern = patternsByKey.get(track.patternKey);
        if (
          project.licenseCode === "cc-by-4.0" &&
          pattern?.reuseMode !== "commercial_reuse"
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "projects",
              projectIndex,
              "tracks",
              trackIndex,
              "patternKey",
            ],
            message: `CC BY project ${project.key} cannot embed reference-only pattern ${track.patternKey}`,
          });
        }
      }
    }
    const ids = [
      ...fixture.projects.flatMap((project) => [
        project.requestId,
        project.saveRequestId,
        project.publishRequestId,
        ...project.tracks.flatMap((track) => [track.trackId, track.clipId]),
      ]),
      ...fixture.patterns.flatMap((pattern) => [
        pattern.requestId,
        pattern.versionRequestId,
        pattern.listingRequestId,
        ...pattern.notes.map((note) => note.noteId),
      ]),
      fixture.challenge.requestId,
      fixture.challenge.publishRequestId,
    ];
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        message: "Fixture UUIDs must be unique",
      });
    }
  });

export const release02BetaContent = betaContentSchema.parse(rawFixture);
export type Release02BetaContent = z.infer<typeof betaContentSchema>;
