import "server-only";

import { z } from "zod";
import {
  decodeMidiLibraryCursor,
  encodeMidiLibraryCursor,
  midiLibraryFilterFingerprint,
} from "@/features/midi-library/schema";
import {
  mapAdminMidiLibraryReport,
  mapMidiLibraryDetail,
  mapMidiLibraryPatternComparison,
} from "@/features/midi-library/detail";
import type {
  MidiLibraryFilters,
  MidiLibraryListing,
  MidiLibraryOptions,
  MidiLibraryPage,
  OwnedMidiLibraryVersion,
  AdminMidiLibraryReport,
  MidiLibraryDetail,
  MidiLibraryPatternComparison,
} from "@/features/midi-library/types";
import type { Database, Json } from "@/lib/supabase/database.types";
import { createSupabaseAnonymousClient } from "@/lib/supabase/anonymous";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ListingInput = z.infer<
  typeof import("@/features/midi-library/schema").midiLibraryListingInputSchema
>;
const noteSchema = z
  .object({
    noteId: z.uuid(),
    startTick: z.number().int().nonnegative(),
    durationTicks: z.number().int().positive(),
    pitch: z.number().int().min(0).max(127),
    velocity: z.number().int().min(1).max(127),
  })
  .strict();
const tagSchema = z.object({ code: z.string(), name: z.string() }).strict();
const creditSchema = z
  .object({
    creditedName: z.string(),
    role: z.string(),
    workTitle: z.string().optional(),
    sourceUrl: z.string().optional(),
    sourceTerms: z.string().optional(),
    attributionNote: z.string().optional(),
  })
  .strict();
const searchRowSchema = z.object({
  listing_id: z.uuid(),
  midi_pattern_id: z.uuid(),
  midi_pattern_version_id: z.uuid(),
  title: z.string(),
  description: z.string(),
  owner_id: z.uuid(),
  creator_username: z.string(),
  creator_display_name: z.string(),
  creator_credit_name: z.string(),
  reuse_mode: z.enum(["commercial_reuse", "reference_only"]),
  rights_basis: z.enum(["original", "authorized_adaptation", "public_domain"]),
  category_code: z.string(),
  category_name: z.string(),
  suggested_preset_id: z.string(),
  suggested_preset_version: z.number().int(),
  suggested_preset_name: z.string(),
  instrument_family_code: z.string(),
  duration_ticks: z.number().int().positive(),
  duration_beats: z.coerce.number().nonnegative(),
  note_count: z.number().int().nonnegative(),
  min_pitch: z.number().int().nullable(),
  max_pitch: z.number().int().nullable(),
  polyphony_kind: z.enum(["monophonic", "polyphonic"]),
  listed_at: z.iso.datetime({ offset: true }),
  tags: z.array(tagSchema),
  external_credits: z.array(creditSchema),
  notes: z.array(noteSchema),
});

function mapListing(input: unknown): MidiLibraryListing {
  const row = searchRowSchema.parse(input);
  return {
    listingId: row.listing_id,
    midiPatternId: row.midi_pattern_id,
    midiPatternVersionId: row.midi_pattern_version_id,
    title: row.title,
    description: row.description,
    ownerId: row.owner_id,
    creatorUsername: row.creator_username,
    creatorDisplayName: row.creator_display_name,
    creatorCreditName: row.creator_credit_name,
    reuseMode: row.reuse_mode,
    rightsBasis: row.rights_basis,
    category: { code: row.category_code, name: row.category_name },
    preset: {
      id: row.suggested_preset_id,
      version: row.suggested_preset_version,
      name: row.suggested_preset_name,
      family: row.instrument_family_code,
    },
    tags: row.tags,
    durationTicks: row.duration_ticks,
    durationBeats: row.duration_beats,
    noteCount: row.note_count,
    minPitch: row.min_pitch,
    maxPitch: row.max_pitch,
    polyphony: row.polyphony_kind,
    listedAt: row.listed_at,
    notes: row.notes,
    externalCredits: row.external_credits,
  };
}

export async function listMidiLibraryOptions(): Promise<MidiLibraryOptions> {
  const db = createSupabaseAnonymousClient();
  const [categories, tags, presets] = await Promise.all([
    db
      .from("midi_library_categories")
      .select("code,display_name")
      .order("sort_order"),
    db
      .from("midi_library_tags")
      .select("code,display_name")
      .order("sort_order"),
    db
      .from("midi_library_presets")
      .select("preset_id,version,family_code,display_name")
      .order("sort_order"),
  ]);
  if (categories.error || tags.error || presets.error)
    throw new Error("midi_library_options_unavailable");
  return {
    categories: categories.data.map((row) => ({
      code: row.code,
      name: row.display_name,
    })),
    tags: tags.data.map((row) => ({ code: row.code, name: row.display_name })),
    presets: presets.data.map((row) => ({
      id: row.preset_id,
      version: row.version,
      family: row.family_code,
      name: row.display_name,
    })),
  };
}

export async function searchPublicMidiLibrary(
  filters: MidiLibraryFilters,
): Promise<MidiLibraryPage> {
  const filterHash = midiLibraryFilterFingerprint({
    ...filters,
    after: undefined,
  } as Omit<MidiLibraryFilters, "after">);
  const cursor = filters.after ? decodeMidiLibraryCursor(filters.after) : null;
  if (
    filters.after &&
    (!cursor ||
      cursor.sort !== filters.sort ||
      cursor.filterHash !== filterHash)
  )
    throw new Error("midi_library_cursor_stale");
  const db = createSupabaseAnonymousClient();
  const args = {
    p_query: filters.query,
    p_rights: filters.rights,
    p_category: filters.category,
    p_preset: filters.preset,
    p_instrument_family: filters.family,
    p_tags: filters.tags,
    p_duration_min: filters.duration.min,
    p_duration_max: filters.duration.max,
    p_notes_min: filters.notes.min,
    p_notes_max: filters.notes.max,
    p_pitch_min: filters.pitch.min,
    p_pitch_max: filters.pitch.max,
    p_polyphony: filters.polyphony,
    p_sort: filters.sort,
    p_after_listed_at: cursor?.listedAt ?? null,
    p_after_title: cursor?.title ?? null,
    p_after_listing_id: cursor?.listingId ?? null,
    p_limit: 25,
  } as unknown as Database["public"]["Functions"]["search_public_midi_library"]["Args"];
  const { data, error } = await db.rpc("search_public_midi_library", args);
  if (error) throw new Error("midi_library_unavailable");
  const parsed = (data ?? []).map(mapListing);
  const listings = parsed.slice(0, 24);
  const last = parsed.length > 24 ? listings.at(-1) : null;
  return {
    listings,
    nextCursor: last
      ? encodeMidiLibraryCursor({
          version: 1,
          sort: filters.sort,
          filterHash,
          listingId: last.listingId,
          listedAt: filters.sort === "recent" ? last.listedAt : null,
          title: filters.sort === "name" ? last.title : null,
        })
      : null,
  };
}

export async function listOwnedMidiLibraryVersions(): Promise<
  OwnedMidiLibraryVersion[]
> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("list_owned_midi_library_versions", {
    p_limit: 100,
  });
  if (error) throw new Error("midi_library_owner_versions_unavailable");
  return (data ?? []).map((row) => ({
    patternId: row.pattern_id,
    patternName: row.pattern_name,
    patternVersionId: row.pattern_version_id,
    versionNumber: row.version_number,
    createdAt: row.created_at,
    reuseLicenseCode: row.reuse_license_code,
    durationTicks: row.duration_ticks,
    noteCount: row.note_count,
    activeListingId: row.active_listing_id,
    activeListingPatternVersionId: row.active_listing_pattern_version_id,
    activeReuseMode:
      row.active_reuse_mode as OwnedMidiLibraryVersion["activeReuseMode"],
    activeCreatorVersion: row.active_creator_version,
  }));
}

export async function listMidiLibraryPatternVersion(input: ListingInput) {
  const db = await createSupabaseServerClient();
  const args = {
    p_pattern_version_id: input.patternVersionId,
    p_request_id: input.requestId,
    p_reuse_mode: input.reuseMode,
    p_rights_basis: input.rightsBasis,
    p_attestation_version: input.attestationVersion,
    p_description: input.description,
    p_supporting_source_url: input.supportingSourceUrl,
    p_supporting_source_terms: input.supportingSourceTerms,
    p_public_domain_rationale: input.publicDomainRationale,
    p_category_code: input.categoryCode,
    p_suggested_preset_id: input.suggestedPresetId,
    p_suggested_preset_version: input.suggestedPresetVersion,
    p_tags: input.tags,
    p_external_credits: input.externalCredits as Json,
    p_replace_listing_id: input.replaceListingId,
  } as unknown as Database["public"]["Functions"]["list_midi_library_pattern_version"]["Args"];
  const { data, error } = await db.rpc(
    "list_midi_library_pattern_version",
    args,
  );
  if (error || !data?.[0])
    throw new Error(error?.message ?? "midi_library_listing_failed");
  return data[0];
}

export async function unlistMidiLibraryListing(input: {
  listingId: string;
  requestId: string;
  expectedCreatorVersion: number;
}) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("unlist_midi_library_listing", {
    p_listing_id: input.listingId,
    p_request_id: input.requestId,
    p_expected_creator_version: input.expectedCreatorVersion,
  });
  if (error || !data?.[0])
    throw new Error(error?.message ?? "midi_library_unlist_failed");
  return data[0];
}

export async function getPublicMidiLibraryListing(
  listingId: string,
): Promise<MidiLibraryDetail | null> {
  const db = createSupabaseAnonymousClient();
  const { data, error } = await db.rpc(
    "get_public_midi_library_listing" as never,
    { p_listing_id: listingId } as never,
  );
  if (error) throw new Error("midi_library_detail_unavailable");
  return data ? mapMidiLibraryDetail(data) : null;
}

export async function getPublicMidiLibraryPatternComparison(input: {
  listingId: string;
  fromPatternVersionId: string;
  toPatternVersionId: string;
}): Promise<MidiLibraryPatternComparison | null> {
  const db = createSupabaseAnonymousClient();
  const { data, error } = await db.rpc(
    "get_public_midi_library_pattern_comparison" as never,
    {
      p_listing_id: input.listingId,
      p_from_pattern_version_id: input.fromPatternVersionId,
      p_to_pattern_version_id: input.toPatternVersionId,
    } as never,
  );
  if (error)
    throw new Error(error.message || "midi_library_comparison_unavailable");
  return data ? mapMidiLibraryPatternComparison(data) : null;
}

export async function submitMidiLibraryReport(input: {
  listingId: string;
  requestId: string;
  claimantRole: string;
  originalWorkTitle: string | null;
  sourceUrl: string | null;
  evidence: string;
}) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc(
    "submit_midi_library_report" as never,
    {
      p_listing_id: input.listingId,
      p_request_id: input.requestId,
      p_claimant_role: input.claimantRole,
      p_original_work_title: input.originalWorkTitle,
      p_source_url: input.sourceUrl,
      p_evidence: input.evidence,
    } as never,
  );
  const row = (
    data as Array<{ report_id: string; status: string }> | null
  )?.[0];
  if (error || !row)
    throw new Error(error?.message ?? "midi_library_report_failed");
  return row;
}

export async function listAdminMidiLibraryReports(): Promise<
  Array<
    Pick<
      AdminMidiLibraryReport,
      | "id"
      | "listingId"
      | "title"
      | "reason"
      | "claimantRole"
      | "status"
      | "createdAt"
      | "updatedAt"
    >
  >
> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc(
    "list_admin_midi_library_reports" as never,
  );
  if (error) throw new Error("midi_library_admin_queue_unavailable");
  return z
    .array(
      z.object({
        id: z.uuid(),
        listingId: z.uuid(),
        title: z.string(),
        reason: z.literal("unoriginal_or_unauthorized"),
        claimantRole: z.enum([
          "rightsholder",
          "authorized_representative",
          "observer",
          "other",
        ]),
        status: z.enum(["submitted", "reviewing", "resolved", "dismissed"]),
        createdAt: z.iso.datetime({ offset: true }),
        updatedAt: z.iso.datetime({ offset: true }),
      }),
    )
    .parse(data);
}

export async function getAdminMidiLibraryReport(
  reportId: string,
): Promise<AdminMidiLibraryReport | null> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc(
    "get_admin_midi_library_report" as never,
    { p_report_id: reportId } as never,
  );
  if (error) throw new Error("midi_library_admin_report_unavailable");
  return data ? mapAdminMidiLibraryReport(data) : null;
}

export async function applyMidiLibraryModerationAction(input: {
  reportId: string;
  requestId: string;
  action: string;
  reason: string;
  expectedReportStatus: string;
  expectedTargetVersion: number;
}) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc(
    "apply_midi_library_moderation_action" as never,
    {
      p_report_id: input.reportId,
      p_request_id: input.requestId,
      p_action: input.action,
      p_reason: input.reason,
      p_expected_report_status: input.expectedReportStatus,
      p_expected_target_version: input.expectedTargetVersion,
    } as never,
  );
  if (error || !data)
    throw new Error(error?.message ?? "midi_library_moderation_failed");
  return data;
}
