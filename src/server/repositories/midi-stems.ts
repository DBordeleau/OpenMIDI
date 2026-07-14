import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  parseMidiStemDraft,
  type MidiNoteV1,
} from "@/features/studio/manifest/v2";
import { midiStemEntryModeSchema } from "@/features/midi/stems/schema";
import type {
  MidiStemDraft,
  MidiStemVersionSummary,
} from "@/features/midi/stems/types";
import { resolveSynthPreset } from "@/features/midi/presets";

type DraftRow = Database["public"]["Tables"]["midi_stem_drafts"]["Row"];

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
      "id,stem_id,version,name,note_count,default_preset_id,default_preset_version,created_at",
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
    defaultPresetId: row.default_preset_id,
    defaultPresetVersion: row.default_preset_version,
    createdAt: row.created_at,
  }));
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
