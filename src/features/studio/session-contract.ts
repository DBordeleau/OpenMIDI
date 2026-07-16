import { z } from "zod";
import { workspaceManifestV1Schema } from "./manifest/schema";
import { workspaceManifestV2Schema } from "./manifest/v2";
import { manifestV3Schema } from "./manifest/v3";

export const studioCapabilitiesSchema = z
  .object({
    canEdit: z.boolean(),
    canPublish: z.boolean(),
    canSubmit: z.boolean(),
    canStartContribution: z.boolean(),
    canDownloadSources: z.boolean(),
    canFork: z.boolean(),
  })
  .strict();

const canonicalLinksSchema = z
  .object({
    project: z.string().regex(/^\/projects\/[0-9a-f-]+$/),
    studio: z.string().regex(/^\/studio\/[0-9a-f-]+$/),
    completion: z
      .string()
      .regex(/^\/[a-z0-9/_?=&-]+$/i)
      .nullable(),
  })
  .strict();

const projectSchema = z
  .object({
    projectId: z.uuid(),
    title: z.string().trim().min(1).max(120),
    compatibility: z.enum(["midi", "legacy_hybrid"]),
    currentRevisionId: z.uuid().nullable(),
  })
  .strict();

const commonSessionSchema = {
  viewerId: z.uuid().nullable(),
  project: projectSchema,
  manifest: z.union([
    workspaceManifestV1Schema,
    workspaceManifestV2Schema,
    manifestV3Schema,
  ]),
  capabilities: studioCapabilitiesSchema,
  canonicalLinks: canonicalLinksSchema,
} as const;

export const studioSessionDescriptorSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("ownerWorkspace"),
      ...commonSessionSchema,
      authority: z
        .object({
          kind: z.literal("workspace"),
          workspaceId: z.uuid(),
          baseRevisionId: z.uuid().nullable(),
          lockVersion: z.number().int().nonnegative(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      mode: z.literal("contributionWorkspace"),
      ...commonSessionSchema,
      authority: z
        .object({
          kind: z.literal("contributionWorkspace"),
          workspaceId: z.uuid(),
          contributionId: z.uuid(),
          baseRevisionId: z.uuid(),
          lockVersion: z.number().int().nonnegative(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      mode: z.literal("memberRevision"),
      ...commonSessionSchema,
      authority: z
        .object({
          kind: z.literal("revision"),
          revisionId: z.uuid(),
          revisionNumber: z.number().int().positive(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      mode: z.literal("contributionVersionReview"),
      ...commonSessionSchema,
      authority: z
        .object({
          kind: z.literal("contributionVersion"),
          contributionId: z.uuid(),
          versionId: z.uuid(),
          versionNumber: z.number().int().positive(),
        })
        .strict(),
    })
    .strict(),
]);

export const emptyStudioSessionDescriptorSchema = z
  .object({
    mode: z.literal("empty"),
    viewerId: z.uuid(),
    project: z.null(),
    manifest: z.null(),
    authority: z.null(),
    capabilities: studioCapabilitiesSchema,
    canonicalLinks: z
      .object({
        project: z.null(),
        studio: z.literal("/studio"),
        completion: z.literal("/projects/new"),
      })
      .strict(),
  })
  .strict();

export const anyStudioSessionDescriptorSchema = z.union([
  emptyStudioSessionDescriptorSchema,
  studioSessionDescriptorSchema,
]);

export type StudioCapabilities = z.infer<typeof studioCapabilitiesSchema>;
export type StudioSessionDescriptor = z.infer<
  typeof anyStudioSessionDescriptorSchema
>;

export function parseStudioSessionDescriptor(
  input: unknown,
): StudioSessionDescriptor {
  return anyStudioSessionDescriptorSchema.parse(input);
}
