import { z } from "zod";
import type {
  AdminMidiLibraryReport,
  MidiLibraryDetail,
  MidiLibraryPatternComparison,
} from "./types";

export const libraryUuidSchema = z.uuid();

const noteSchema = z
  .object({
    noteId: libraryUuidSchema,
    startTick: z.number().int().nonnegative(),
    durationTicks: z.number().int().positive(),
    pitch: z.number().int().min(0).max(127),
    velocity: z.number().int().min(1).max(127),
  })
  .strict();

const creditSchema = z
  .object({
    creditedName: z.string(),
    role: z.string(),
    workTitle: z.string().optional(),
    sourceUrl: z.url().optional(),
    sourceTerms: z.string().optional(),
    attributionNote: z.string().optional(),
  })
  .strict();

const historyVersionSchema = z
  .object({
    midiPatternVersionId: libraryUuidSchema,
    midiPatternId: libraryUuidSchema,
    versionNumber: z.number().int().positive(),
    creatorId: libraryUuidSchema,
    creatorCreditName: z.string(),
    parentMidiPatternVersionId: libraryUuidSchema.nullable(),
    sourceMidiPatternVersionId: libraryUuidSchema.nullable(),
    ppq: z.literal(480),
    durationTicks: z.number().int().positive(),
    noteCount: z.number().int().nonnegative(),
    contentSha256: z.string().regex(/^[0-9a-f]{64}$/),
    reuseLicenseCode: z.string().nullable(),
    reuseLicenseVersion: z.string().nullable(),
    reuseLicenseUrl: z.url().nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    notes: z.array(noteSchema).max(2_048),
  })
  .strict();

const listingSchema = z
  .object({
    listingId: libraryUuidSchema,
    midiPatternId: libraryUuidSchema,
    midiPatternVersionId: libraryUuidSchema,
    title: z.string(),
    description: z.string(),
    ownerId: libraryUuidSchema,
    creatorUsername: z.string(),
    creatorDisplayName: z.string(),
    creatorCreditName: z.string(),
    reuseMode: z.enum(["commercial_reuse", "reference_only"]),
    rightsBasis: z.enum(["original", "authorized_adaptation", "public_domain"]),
    attestationVersion: z.string(),
    attestedAt: z.iso.datetime({ offset: true }),
    supportingSourceUrl: z.url().nullable(),
    supportingSourceTerms: z.string().nullable(),
    publicDomainRationale: z.string().nullable(),
    category: z.object({ code: z.string(), name: z.string() }).strict(),
    preset: z
      .object({
        id: z.string(),
        version: z.number().int().positive(),
        name: z.string(),
        family: z.string(),
      })
      .strict(),
    durationTicks: z.number().int().positive(),
    durationBeats: z.coerce.number().nonnegative(),
    noteCount: z.number().int().nonnegative(),
    minPitch: z.number().int().nullable(),
    maxPitch: z.number().int().nullable(),
    polyphony: z.enum(["monophonic", "polyphonic"]),
    listedAt: z.iso.datetime({ offset: true }),
    tags: z.array(z.object({ code: z.string(), name: z.string() }).strict()),
    externalCredits: z.array(creditSchema).max(12),
    notes: z.array(noteSchema).max(2_048),
  })
  .strict();

const detailSchema = z
  .object({
    listing: listingSchema,
    platformLineage: z
      .object({
        patternId: libraryUuidSchema,
        sourcePatternId: libraryUuidSchema.optional(),
        sourcePatternVersionId: libraryUuidSchema.optional(),
        sourceCreatorCreditName: z.string().optional(),
        listedVersionParentId: libraryUuidSchema.optional(),
        listedVersionSourceId: libraryUuidSchema.optional(),
      })
      .strict(),
    history: z.array(historyVersionSchema).max(100),
    usage: z
      .object({
        publicProjectCount: z.number().int().nonnegative(),
        projects: z
          .array(
            z
              .object({
                projectId: libraryUuidSchema,
                title: z.string(),
                revisionId: libraryUuidSchema,
                revisionNumber: z.number().int().positive(),
                publishedAt: z.iso.datetime({ offset: true }),
              })
              .strict(),
          )
          .max(50),
      })
      .strict(),
  })
  .strict();

const comparisonSchema = z
  .object({
    listingId: libraryUuidSchema,
    from: historyVersionSchema,
    to: historyVersionSchema,
  })
  .strict();

const adminReportSchema = z
  .object({
    id: libraryUuidSchema,
    listingId: libraryUuidSchema,
    midiPatternId: libraryUuidSchema,
    midiPatternVersionId: libraryUuidSchema,
    title: z.string(),
    reason: z.literal("unoriginal_or_unauthorized"),
    claimantRole: z.enum([
      "rightsholder",
      "authorized_representative",
      "observer",
      "other",
    ]),
    originalWorkTitle: z.string().optional(),
    sourceUrl: z.url().optional(),
    evidence: z.string(),
    status: z.enum(["submitted", "reviewing", "resolved", "dismissed"]),
    reporterId: libraryUuidSchema,
    assignedAdminId: libraryUuidSchema.optional(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    targetState: z.enum(["visible", "hidden"]),
    targetVersion: z.number().int().positive(),
    unlistedAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();

export function mapMidiLibraryDetail(input: unknown): MidiLibraryDetail {
  const detail = detailSchema.parse(input);
  if (
    detail.listing.midiPatternId !== detail.platformLineage.patternId ||
    detail.history.some(
      (version) => version.midiPatternId !== detail.listing.midiPatternId,
    )
  ) {
    throw new Error("midi_library_detail_pattern_mismatch");
  }
  return detail;
}

export function mapMidiLibraryPatternComparison(
  input: unknown,
): MidiLibraryPatternComparison {
  const comparison = comparisonSchema.parse(input);
  if (comparison.from.midiPatternId !== comparison.to.midiPatternId) {
    throw new Error("midi_library_comparison_pattern_mismatch");
  }
  return comparison;
}

export function mapAdminMidiLibraryReport(
  input: unknown,
): AdminMidiLibraryReport {
  return adminReportSchema.parse(input);
}

export const midiLibraryReportInputSchema = z
  .object({
    listingId: libraryUuidSchema,
    requestId: libraryUuidSchema,
    claimantRole: z.enum([
      "rightsholder",
      "authorized_representative",
      "observer",
      "other",
    ]),
    originalWorkTitle: z.string().trim().min(1).max(160).nullable(),
    sourceUrl: z.url().max(500).nullable(),
    evidence: z.string().trim().min(20).max(2_000),
  })
  .strict();

export const midiLibraryModerationActionSchema = z
  .object({
    reportId: libraryUuidSchema,
    requestId: libraryUuidSchema,
    action: z.enum(["assign_self", "hide", "restore", "resolve", "dismiss"]),
    reason: z.string().trim().min(1).max(500),
    expectedReportStatus: z.enum(["submitted", "reviewing"]),
    expectedTargetVersion: z.number().int().positive(),
  })
  .strict();
