"use server";

import { revalidatePath } from "next/cache";
import { createImportedMidiStemSchema } from "@/features/midi/stems/schema";
import {
  createImportedMidiStemDraft,
  createMidiStemDraft,
  getMidiStemDraft,
  getMidiStemVersion,
} from "@/server/repositories/midi-stems";
import { finalizeStudioMidiDraft } from "@/server/repositories/workspaces";
import { parseWorkspaceManifestV2 } from "../manifest/v2";
import {
  createIntegratedMidiDraftSchema,
  finalizeIntegratedMidiDraftSchema,
  freezeStudioPatternSchema,
} from "./schema";
import {
  createMidiPatternV3,
  createMidiPatternVersionV3,
  getMidiPatternVersionV3,
} from "@/server/repositories/midi-v3";
import { parseMidiPatternVersionV3 } from "../manifest/v3";

export async function createIntegratedMidiDraftAction(input: unknown) {
  const parsed = createIntegratedMidiDraftSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, code: "invalid_request" as const };
  const { data, error } = await createMidiStemDraft({
    requestId: parsed.data.requestId,
    name: parsed.data.name,
    entryMode: parsed.data.parentStemVersionId ? "derive" : "blank",
    parentStemVersionId: parsed.data.parentStemVersionId,
  });
  const created = data?.[0];
  if (error || !created)
    return {
      ok: false as const,
      code:
        error?.message === "midi_stem_parent_not_found"
          ? ("parent_unavailable" as const)
          : error?.message === "midi_stem_limit_reached"
            ? ("limit" as const)
            : ("unavailable" as const),
    };
  const draft = await getMidiStemDraft(created.stem_id);
  return draft
    ? { ok: true as const, draft }
    : { ok: false as const, code: "unavailable" as const };
}

export async function createIntegratedImportedMidiDraftAction(input: unknown) {
  const parsed = createImportedMidiStemSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, code: "invalid_request" as const };
  const { data, error } = await createImportedMidiStemDraft(parsed.data);
  const created = data?.[0];
  if (error || !created)
    return { ok: false as const, code: "unavailable" as const };
  const draft = await getMidiStemDraft(created.stem_id);
  return draft
    ? { ok: true as const, draft }
    : { ok: false as const, code: "unavailable" as const };
}

export async function finalizeIntegratedMidiDraftAction(input: unknown) {
  const parsed = finalizeIntegratedMidiDraftSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, code: "invalid_request" as const };
  const { data, error } = await finalizeStudioMidiDraft(parsed.data);
  const applied = data?.[0];
  if (error || !applied)
    return {
      ok: false as const,
      code:
        error?.message === "workspace_save_conflict"
          ? ("workspace_conflict" as const)
          : error?.message === "midi_stem_publish_conflict"
            ? ("draft_conflict" as const)
            : error?.message === "studio_midi_target_not_found"
              ? ("target_missing" as const)
              : error?.code === "PT404"
                ? ("not_found" as const)
                : ("unavailable" as const),
    };
  const version = await getMidiStemVersion(applied.stem_version_id);
  if (!version) return { ok: false as const, code: "unavailable" as const };
  revalidatePath(`/studio/${parsed.data.projectId}`);
  revalidatePath("/stems");
  return {
    ok: true as const,
    version,
    manifest: parseWorkspaceManifestV2(applied.workspace_manifest),
    workspaceLockVersion: applied.workspace_lock_version,
    manifestSha256: applied.workspace_manifest_sha256,
    workspaceUpdatedAt: applied.workspace_updated_at,
  };
}

export async function freezeStudioPatternAction(input: unknown) {
  const parsed = freezeStudioPatternSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, code: "invalid_request" as const };
  try {
    const patternId = parsed.data.existingPatternId
      ? parsed.data.existingPatternId
      : (
          await createMidiPatternV3({
            requestId: parsed.data.patternRequestId,
            name: parsed.data.name,
            ...(parsed.data.sourcePatternVersionId
              ? { sourcePatternVersionId: parsed.data.sourcePatternVersionId }
              : {}),
          })
        ).pattern_id;
    const frozen = await createMidiPatternVersionV3({
      patternId,
      requestId: parsed.data.versionRequestId,
      expectedVersionNumber: parsed.data.expectedVersionNumber,
      durationTicks: parsed.data.content.durationTicks,
      notes: parsed.data.content.notes,
      publishForReuse: false,
    });
    const record = await getMidiPatternVersionV3(frozen.pattern_version_id);
    if (!record) throw new Error("pattern_version_unavailable");
    return {
      ok: true as const,
      version: parseMidiPatternVersionV3({
        midiPatternVersionId: record.id,
        midiPatternId: record.midi_pattern_id,
        version: record.version_number,
        creatorId: record.creator_id,
        creatorCreditName: record.creator_credit_name,
        parentMidiPatternVersionId: record.parent_pattern_version_id,
        sourceMidiPatternVersionId: record.source_pattern_version_id,
        contentSha256: record.content_sha256,
        noteCount: record.note_count,
        ppq: record.ppq,
        durationTicks: record.duration_ticks,
        reuseLicense: null,
        createdAt: record.created_at,
        notes: record.notes.map((note) => ({
          noteId: note.note_id,
          startTick: note.start_tick,
          durationTicks: note.duration_ticks,
          pitch: note.pitch,
          velocity: note.velocity,
        })),
      }),
    };
  } catch {
    return { ok: false as const, code: "unavailable" as const };
  }
}
