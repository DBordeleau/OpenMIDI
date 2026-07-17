import { z } from "zod";
import type {
  MidiLibraryCursor,
  MidiLibraryFilters,
  NumericRange,
} from "./types";

type RawSearchParams = Record<string, string | string[] | undefined>;
const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(64);
const cursorSchema = z
  .object({
    version: z.literal(1),
    sort: z.enum(["recent", "name"]),
    filterHash: z.string().min(1).max(16),
    listingId: z.uuid(),
    listedAt: z.iso.datetime({ offset: true }).nullable(),
    title: z.string().min(1).max(120).nullable(),
  })
  .strict()
  .refine(
    (cursor) =>
      cursor.sort === "recent"
        ? cursor.listedAt !== null && cursor.title === null
        : cursor.title !== null && cursor.listedAt === null,
    { message: "Cursor tuple does not match its sort." },
  );

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value.length === 1 ? value[0] : null) : value;
}
function repeated(value: string | string[] | undefined) {
  return Array.isArray(value) && value.length !== 1;
}
function parseRange(
  value: string | null | undefined,
  maximum: number,
): NumericRange | null {
  if (!value) return { min: null, max: null };
  const match = value.match(
    /^(\d{1,8}(?:\.\d{1,3})?)-(?:(\d{1,8}(?:\.\d{1,3})?))?$/,
  );
  if (!match) return null;
  const min = Number(match[1]);
  const max = match[2] === undefined ? null : Number(match[2]);
  if (
    min < 0 ||
    min > maximum ||
    (max !== null && (max < min || max > maximum))
  )
    return null;
  return { min, max };
}

export function midiLibraryFilterFingerprint(
  filters: Omit<MidiLibraryFilters, "after">,
) {
  const source = JSON.stringify(filters);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function parseMidiLibraryFilters(
  params: RawSearchParams,
):
  | { success: true; data: MidiLibraryFilters }
  | { success: false; message: string } {
  const scalarNames = [
    "q",
    "rights",
    "category",
    "family",
    "preset",
    "tags",
    "duration",
    "notes",
    "pitch",
    "polyphony",
    "sort",
    "after",
  ] as const;
  if (scalarNames.some((name) => repeated(params[name]))) {
    return {
      success: false,
      message: "Check the library filters, then try again.",
    };
  }
  const query = (scalar(params.q) ?? "").trim();
  const rights = scalar(params.rights) ?? "all";
  const category = scalar(params.category) || null;
  const family = scalar(params.family) || null;
  const preset = scalar(params.preset) || null;
  const rawTags = scalar(params.tags) ?? "";
  const tags = [...new Set(rawTags.split(",").filter(Boolean))].sort();
  const duration = parseRange(scalar(params.duration), 180000);
  const notes = parseRange(scalar(params.notes), 2048);
  const pitch = parseRange(scalar(params.pitch), 127);
  const polyphony = scalar(params.polyphony) || null;
  const sort = scalar(params.sort) ?? "recent";
  const after = scalar(params.after) || null;
  if (
    query.length > 80 ||
    !["all", "commercial_reuse", "reference_only"].includes(rights) ||
    (category !== null && !slugSchema.safeParse(category).success) ||
    (family !== null && !slugSchema.safeParse(family).success) ||
    (preset !== null && !slugSchema.safeParse(preset).success) ||
    tags.length > 8 ||
    !tags.every((tag) => slugSchema.safeParse(tag).success) ||
    !duration ||
    !notes ||
    !pitch ||
    (polyphony !== null && !["monophonic", "polyphonic"].includes(polyphony)) ||
    !["recent", "name"].includes(sort) ||
    (after !== null && after.length > 512)
  )
    return {
      success: false,
      message: "Check the library filters, then try again.",
    };
  return {
    success: true,
    data: {
      query: query || null,
      rights: rights as MidiLibraryFilters["rights"],
      category,
      family,
      preset,
      tags,
      duration,
      notes,
      pitch,
      polyphony: polyphony as MidiLibraryFilters["polyphony"],
      sort: sort as MidiLibraryFilters["sort"],
      after,
    },
  };
}

export function encodeMidiLibraryCursor(cursor: MidiLibraryCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}
export function decodeMidiLibraryCursor(value: string) {
  if (value.length > 512) return null;
  try {
    return cursorSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
  } catch {
    return null;
  }
}
function rangeValue(range: NumericRange) {
  return range.min === null ? null : `${range.min}-${range.max ?? ""}`;
}
export function midiLibrarySearchParams(filters: MidiLibraryFilters) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.rights !== "all") params.set("rights", filters.rights);
  if (filters.category) params.set("category", filters.category);
  if (filters.family) params.set("family", filters.family);
  if (filters.preset) params.set("preset", filters.preset);
  if (filters.tags.length) params.set("tags", filters.tags.join(","));
  const duration = rangeValue(filters.duration);
  if (duration) params.set("duration", duration);
  const notes = rangeValue(filters.notes);
  if (notes) params.set("notes", notes);
  const pitch = rangeValue(filters.pitch);
  if (pitch) params.set("pitch", pitch);
  if (filters.polyphony) params.set("polyphony", filters.polyphony);
  if (filters.sort !== "recent") params.set("sort", filters.sort);
  if (filters.after) params.set("after", filters.after);
  return params;
}

const optionalHttps = z.union([
  z.literal(""),
  z.url().startsWith("https://").max(500),
]);
export const externalCreditInputSchema = z
  .object({
    creditedName: z.string().trim().min(1).max(120),
    role: z.string().trim().min(1).max(80),
    workTitle: z.string().trim().max(160).optional(),
    sourceUrl: optionalHttps.optional(),
    sourceTerms: z.string().trim().max(500).optional(),
    attributionNote: z.string().trim().max(500).optional(),
  })
  .strict();
export const midiLibraryListingInputSchema = z
  .object({
    patternVersionId: z.uuid(),
    requestId: z.uuid(),
    reuseMode: z.enum(["commercial_reuse", "reference_only"]),
    rightsBasis: z.enum(["original", "authorized_adaptation", "public_domain"]),
    attestationVersion: z.enum([
      "midi-library-commercial-attestation-v1",
      "midi-library-reference-display-attestation-v1",
    ]),
    description: z.string().trim().max(1000),
    supportingSourceUrl: optionalHttps.nullable(),
    supportingSourceTerms: z.string().trim().min(1).max(500).nullable(),
    publicDomainRationale: z.string().trim().min(1).max(500).nullable(),
    categoryCode: slugSchema,
    suggestedPresetId: slugSchema,
    suggestedPresetVersion: z.literal(1),
    tags: z
      .array(slugSchema)
      .max(8)
      .transform((tags) => [...new Set(tags)].sort()),
    externalCredits: z.array(externalCreditInputSchema).max(12),
    replaceListingId: z.uuid().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const attestationMatches =
      value.reuseMode === "commercial_reuse"
        ? value.attestationVersion === "midi-library-commercial-attestation-v1"
        : value.attestationVersion ===
          "midi-library-reference-display-attestation-v1";
    if (!attestationMatches)
      context.addIssue({
        code: "custom",
        path: ["attestationVersion"],
        message: "Attestation does not match reuse mode.",
      });
    if (
      value.rightsBasis === "original" &&
      (value.supportingSourceUrl ||
        value.supportingSourceTerms ||
        value.publicDomainRationale)
    )
      context.addIssue({
        code: "custom",
        path: ["rightsBasis"],
        message: "Original material does not use source evidence.",
      });
    if (
      value.rightsBasis === "authorized_adaptation" &&
      (!value.supportingSourceUrl ||
        !value.supportingSourceTerms ||
        value.publicDomainRationale)
    )
      context.addIssue({
        code: "custom",
        path: ["rightsBasis"],
        message:
          "Authorized adaptations require an HTTPS source and supporting terms.",
      });
    if (
      value.rightsBasis === "public_domain" &&
      (!value.supportingSourceUrl ||
        value.supportingSourceTerms ||
        !value.publicDomainRationale)
    )
      context.addIssue({
        code: "custom",
        path: ["rightsBasis"],
        message:
          "Public-domain listings require an HTTPS source and rationale.",
      });
    if (value.rightsBasis !== "original" && value.externalCredits.length === 0)
      context.addIssue({
        code: "custom",
        path: ["externalCredits"],
        message: "Record at least one external credit.",
      });
  });
export const midiLibraryUnlistInputSchema = z
  .object({
    listingId: z.uuid(),
    requestId: z.uuid(),
    expectedCreatorVersion: z.number().int().positive(),
  })
  .strict();
