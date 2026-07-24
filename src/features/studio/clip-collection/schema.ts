import { z } from "zod";
import {
  MIDI_V3_MAX_DURATION_TICKS,
  midiPatternVersionV3Schema,
} from "@/features/midi/domain-v3";
import { workspaceManifestV3Schema } from "../manifest/v3";

export const studioClipSourceSchema = z.enum(["owned", "saved"]);
export const studioClipAvailabilitySchema = z.enum([
  "available",
  "unlisted",
  "moderation_hidden",
  "source_unavailable",
  "reference_only",
  "license_unavailable",
  "preset_unavailable",
]);

const reuseLicenseSchema = z
  .object({
    code: z.literal("CC-BY-4.0"),
    version: z.literal("4.0"),
    url: z.literal("https://creativecommons.org/licenses/by/4.0/"),
  })
  .strict();

const presetSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    version: z.number().int().positive(),
    name: z.string().trim().min(1).max(120),
  })
  .strict();

export const studioClipMetadataSchema = z
  .object({
    patternId: z.uuid(),
    patternVersionId: z.uuid(),
    patternName: z.string().trim().min(1).max(120),
    versionNumber: z.number().int().positive(),
    creatorId: z.uuid(),
    creatorCreditName: z.string().trim().min(1).max(120),
    durationTicks: z.number().int().positive().max(MIDI_V3_MAX_DURATION_TICKS),
    noteCount: z.number().int().min(0).max(2_048),
    createdAt: z.iso.datetime({ offset: true }),
    hasLineage: z.boolean(),
    versionCount: z.number().int().positive().max(2_147_483_647).optional(),
    source: studioClipSourceSchema,
    isOwned: z.boolean(),
    isSaved: z.boolean(),
    savedListingId: z.uuid().optional(),
    savedAt: z.iso.datetime({ offset: true }).optional(),
    savedAvailability: studioClipAvailabilitySchema.optional(),
    savedCanImport: z.boolean().optional(),
    availability: studioClipAvailabilitySchema,
    canImport: z.boolean(),
    preset: presetSchema.optional(),
    reuseLicense: reuseLicenseSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.source === "owned" && !value.isOwned) {
      context.addIssue({
        code: "custom",
        path: ["source"],
        message: "Owned source requires owner authority.",
      });
    }
    if (value.source === "saved" && !value.isSaved) {
      context.addIssue({
        code: "custom",
        path: ["source"],
        message: "Saved source requires bookmark authority.",
      });
    }
    const hasSavedMetadata =
      value.savedListingId !== undefined &&
      value.savedAt !== undefined &&
      value.savedAvailability !== undefined &&
      value.savedCanImport !== undefined;
    if (value.isSaved !== hasSavedMetadata) {
      context.addIssue({
        code: "custom",
        path: ["isSaved"],
        message: "Saved provenance metadata is incomplete.",
      });
    }
    if (value.canImport && value.preset === undefined) {
      context.addIssue({
        code: "custom",
        path: ["canImport"],
        message: "Importable metadata requires a validated preset.",
      });
    }
  });

export const studioClipCollectionSchema = z
  .object({
    items: z.array(studioClipMetadataSchema).max(100),
  })
  .strict();

export const studioClipCreditSchema = z
  .object({
    creditedName: z.string().trim().min(1).max(120),
    role: z.string().trim().min(1).max(80),
    workTitle: z.string().trim().min(1).max(160).optional(),
    sourceUrl: z.url().startsWith("https://").max(500).optional(),
    sourceTerms: z.string().trim().min(1).max(500).optional(),
    attributionNote: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const studioImportedPatternSchema =
  midiPatternVersionV3Schema.safeExtend({
    name: z.string().trim().min(1).max(120),
    presetId: z.string().trim().min(1).max(64),
    presetVersion: z.number().int().positive(),
  });

export const studioClipDetailSchema = z
  .object({
    metadata: studioClipMetadataSchema,
    externalCredits: z.array(studioClipCreditSchema).max(12),
    pattern: studioImportedPatternSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.metadata.canImport !== (value.pattern !== null)) {
      context.addIssue({
        code: "custom",
        path: ["pattern"],
        message: "MIDI detail must match current import authority.",
      });
    }
    if (
      value.pattern &&
      value.pattern.midiPatternVersionId !== value.metadata.patternVersionId
    ) {
      context.addIssue({
        code: "custom",
        path: ["pattern", "midiPatternVersionId"],
        message: "Detail version does not match its metadata.",
      });
    }
  });

export const listStudioClipCollectionInputSchema = z
  .object({
    source: z.enum(["all", "owned", "saved"]).default("all"),
    query: z.string().trim().max(80).nullable().default(null),
    limit: z.number().int().min(1).max(100).default(100),
  })
  .strict();

export const getStudioClipDetailInputSchema = z
  .object({ patternVersionId: z.uuid() })
  .strict();

export const importStudioClipInputSchema = z
  .object({
    patternVersionId: z.uuid(),
    source: studioClipSourceSchema,
    workspaceId: z.uuid(),
    requestId: z.uuid(),
    expectedWorkspaceLockVersion: z.number().int().positive(),
    startTick: z.number().int().nonnegative().max(MIDI_V3_MAX_DURATION_TICKS),
  })
  .strict();

export const importStudioClipResultSchema = z
  .object({
    source: z
      .object({
        kind: studioClipSourceSchema,
        savedListingId: z.uuid().nullable(),
        externalCredits: z.array(studioClipCreditSchema).max(12),
      })
      .strict(),
    projectId: z.uuid(),
    workspaceId: z.uuid(),
    contributionId: z.uuid().nullable(),
    lockVersion: z.number().int().positive(),
    manifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
    manifest: workspaceManifestV3Schema,
    trackId: z.uuid(),
    clipId: z.uuid(),
    importedPattern: studioImportedPatternSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.source.kind === "saved" && value.source.savedListingId === null) {
      context.addIssue({
        code: "custom",
        path: ["source", "savedListingId"],
        message: "Saved imports require exact listing provenance.",
      });
    }
    if (value.source.kind === "owned" && value.source.savedListingId !== null) {
      context.addIssue({
        code: "custom",
        path: ["source", "savedListingId"],
        message: "Owner-authorized imports do not use listing authority.",
      });
    }
    if (
      value.manifest.projectId !== value.projectId ||
      value.manifest.workspaceId !== value.workspaceId
    ) {
      context.addIssue({
        code: "custom",
        path: ["manifest"],
        message: "Canonical manifest authority does not match the workspace.",
      });
    }
    const track = value.manifest.tracks.find(
      (candidate) => candidate.trackId === value.trackId,
    );
    const clip = track?.clips.find(
      (candidate) => candidate.clipId === value.clipId,
    );
    if (
      !track ||
      !clip ||
      clip.midiPatternVersionId !==
        value.importedPattern.midiPatternVersionId ||
      track.presetId !== value.importedPattern.presetId ||
      track.presetVersion !== value.importedPattern.presetVersion
    ) {
      context.addIssue({
        code: "custom",
        path: ["trackId"],
        message: "Imported track, clip, and playback payload disagree.",
      });
    }
  });

export type StudioClipCollection = z.infer<typeof studioClipCollectionSchema>;
export type StudioClipDetail = z.infer<typeof studioClipDetailSchema>;
export type ImportStudioClipResult = z.infer<
  typeof importStudioClipResultSchema
>;
