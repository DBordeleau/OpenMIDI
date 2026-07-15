import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  parseMidiStemDraft,
  parseMidiStemVersion,
  type MidiNoteV1,
} from "@/features/studio/manifest/v2";
import { midiStemEntryModeSchema } from "@/features/midi/stems/schema";
import type {
  MidiStemDraft,
  MidiStemVersion,
  MidiStemVersionSummary,
} from "@/features/midi/stems/types";
import { resolveSynthPreset } from "@/features/midi/presets";

type DraftRow = Database["public"]["Tables"]["midi_stem_drafts"]["Row"];
type VersionRow = Database["public"]["Tables"]["midi_stem_versions"]["Row"];
const MIDI_VERSION_ID_QUERY_BATCH_SIZE = 100;

function mapDraft(row: DraftRow): MidiStemDraft {
  const parsed = parseMidiStemDraft({
    draftId: row.id,
    stemId: row.stem_id,
    ownerId: row.owner_id,
    parentStemVersionId: row.parent_stem_version_id,
    lockVersion: row.lock_version,
    name: row.name,
    defaultPresetId: row.default_preset_id,
    defaultPresetVersion: row.default_preset_version,
    ppq: row.ppq,
    durationTicks: row.duration_ticks,
    notes: row.notes,
  });
  resolveSynthPreset(parsed.defaultPresetId, parsed.defaultPresetVersion);
  return {
    draftId: parsed.draftId,
    stemId: parsed.stemId,
    ownerId: parsed.ownerId,
    entryMode: midiStemEntryModeSchema.parse(row.entry_mode),
    parentStemVersionId: parsed.parentStemVersionId,
    name: parsed.name,
    defaultPresetId: parsed.defaultPresetId,
    defaultPresetVersion: parsed.defaultPresetVersion,
    ppq: parsed.ppq,
    durationTicks: parsed.durationTicks,
    notes: parsed.notes as MidiNoteV1[],
    noteCount: row.note_count,
    contentSha256: row.content_sha256,
    lockVersion: parsed.lockVersion,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listMidiStemDrafts(): Promise<MidiStemDraft[]> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("midi_stem_drafts")
    .select("*")
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);
  if (error) throw new Error("midi_stems_unavailable");
  return data.map(mapDraft);
}

export async function listMidiStemVersions(): Promise<
  MidiStemVersionSummary[]
> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("midi_stem_versions")
    .select(
      "id,stem_id,version,name,note_count,duration_ticks,default_preset_id,default_preset_version,parent_stem_version_id,creator_credit_name,created_at",
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(500);
  if (error) throw new Error("midi_stems_unavailable");
  return data.map((row) => ({
    stemVersionId: row.id,
    stemId: row.stem_id,
    version: row.version,
    name: row.name,
    noteCount: row.note_count,
    durationTicks: row.duration_ticks,
    defaultPresetId: row.default_preset_id,
    defaultPresetVersion: row.default_preset_version,
    parentStemVersionId: row.parent_stem_version_id,
    creatorCreditName: row.creator_credit_name,
    createdAt: row.created_at,
  }));
}

export async function getMidiStemVersion(
  stemVersionId: string,
): Promise<MidiStemVersion | null> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("midi_stem_versions")
    .select("*")
    .eq("id", stemVersionId)
    .maybeSingle();
  if (error) throw new Error("midi_stems_unavailable");
  if (!data) return null;
  return mapVersion(data);
}

function mapVersion(data: VersionRow): MidiStemVersion {
  const parsed = parseMidiStemVersion({
    stemVersionId: data.id,
    stemId: data.stem_id,
    creatorId: data.owner_id,
    parentStemVersionId: data.parent_stem_version_id,
    version: data.version,
    name: data.name,
    defaultPresetId: data.default_preset_id,
    defaultPresetVersion: data.default_preset_version,
    ppq: data.ppq,
    durationTicks: data.duration_ticks,
    notes: data.notes,
    contentSha256: data.content_sha256,
  });
  resolveSynthPreset(parsed.defaultPresetId, parsed.defaultPresetVersion);
  return {
    stemVersionId: data.id,
    stemId: data.stem_id,
    version: data.version,
    name: parsed.name,
    noteCount: data.note_count,
    defaultPresetId: parsed.defaultPresetId,
    defaultPresetVersion: parsed.defaultPresetVersion,
    parentStemVersionId: data.parent_stem_version_id,
    creatorId: data.owner_id,
    creatorCreditName: data.creator_credit_name,
    ppq: parsed.ppq,
    durationTicks: parsed.durationTicks,
    notes: parsed.notes as MidiNoteV1[],
    contentSha256: data.content_sha256,
    createdAt: data.created_at,
  };
}

export async function listMidiStemVersionsForStudio(): Promise<
  MidiStemVersion[]
> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("midi_stem_versions")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(500);
  if (error) throw new Error("midi_stems_unavailable");
  return data.map(mapVersion);
}

export async function getMidiStemVersionsByIds(
  stemVersionIds: string[],
): Promise<MidiStemVersion[]> {
  const uniqueIds = [...new Set(stemVersionIds)];
  if (uniqueIds.length === 0) return [];
  const db = await createSupabaseServerClient();
  const rows: VersionRow[] = [];
  for (
    let offset = 0;
    offset < uniqueIds.length;
    offset += MIDI_VERSION_ID_QUERY_BATCH_SIZE
  ) {
    const batch = uniqueIds.slice(
      offset,
      offset + MIDI_VERSION_ID_QUERY_BATCH_SIZE,
    );
    const { data, error } = await db
      .from("midi_stem_versions")
      .select("*")
      .in("id", batch);
    if (error) throw new Error("midi_stems_unavailable");
    rows.push(...data);
  }
  const versions = new Map(rows.map((row) => [row.id, mapVersion(row)]));
  if (versions.size !== uniqueIds.length)
    throw new Error("midi_stem_reference_unavailable");
  return uniqueIds.map((id) => versions.get(id)!);
}

export async function getMidiStemDraft(
  stemId: string,
): Promise<MidiStemDraft | null> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("midi_stem_drafts")
    .select("*")
    .eq("stem_id", stemId)
    .maybeSingle();
  if (error) throw new Error("midi_stems_unavailable");
  return data ? mapDraft(data) : null;
}

export async function createMidiStemDraft(input: {
  requestId: string;
  name: string;
  entryMode: "blank" | "import" | "derive";
  parentStemVersionId: string | null;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("create_midi_stem_draft", {
    p_request_id: input.requestId,
    p_name: input.name,
    p_entry_mode: input.entryMode,
    ...(input.parentStemVersionId
      ? { p_parent_stem_version_id: input.parentStemVersionId }
      : {}),
  });
}

export async function createImportedMidiStemDraft(input: {
  requestId: string;
  saveRequestId: string;
  content: {
    name: string;
    defaultPresetId: string;
    defaultPresetVersion: number;
    ppq: 480;
    durationTicks: number;
    notes: MidiNoteV1[];
  };
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("create_imported_midi_stem_draft", {
    p_request_id: input.requestId,
    p_save_request_id: input.saveRequestId,
    p_content:
      input.content as unknown as Database["public"]["Functions"]["save_midi_stem_draft"]["Args"]["p_content"],
  });
}

export async function saveMidiStemDraft(input: {
  draftId: string;
  requestId: string;
  expectedLockVersion: number;
  content: {
    name: string;
    defaultPresetId: string;
    defaultPresetVersion: number;
    ppq: 480;
    durationTicks: number;
    notes: MidiNoteV1[];
  };
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("save_midi_stem_draft", {
    p_draft_id: input.draftId,
    p_request_id: input.requestId,
    p_expected_lock_version: input.expectedLockVersion,
    p_content:
      input.content as unknown as Database["public"]["Functions"]["save_midi_stem_draft"]["Args"]["p_content"],
  });
}

export async function publishMidiStemVersion(input: {
  draftId: string;
  requestId: string;
  expectedLockVersion: number;
  expectedContentSha256: string;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("publish_midi_stem_version", {
    p_draft_id: input.draftId,
    p_request_id: input.requestId,
    p_expected_lock_version: input.expectedLockVersion,
    p_expected_content_sha256: input.expectedContentSha256,
  });
}
