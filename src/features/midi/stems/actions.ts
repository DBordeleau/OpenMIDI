"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canonicalizeMidiNotes } from "@/features/studio/manifest/v2";
import { z } from "zod";
import {
  createImportedMidiStemSchema,
  createMidiStemDraftSchema,
  publishMidiStemVersionSchema,
  saveMidiStemDraftSchema,
} from "./schema";
import {
  createImportedMidiStemDraft,
  createMidiStemDraft,
  getMidiStemVersion,
  publishMidiStemVersion,
  saveMidiStemDraft,
} from "@/server/repositories/midi-stems";

export type CreateMidiStemState = { message?: string };

export async function createMidiStemDraftAction(
  _state: CreateMidiStemState,
  formData: FormData,
): Promise<CreateMidiStemState> {
  const parsed = createMidiStemDraftSchema.safeParse({
    requestId: formData.get("requestId"),
    name: formData.get("name"),
    entryMode: formData.get("entryMode"),
    parentStemVersionId: formData.get("parentStemVersionId") || null,
  });
  if (!parsed.success)
    return { message: "Name the stem, then try creating the draft again." };
  const { data, error } = await createMidiStemDraft(parsed.data);
  const created = data?.[0];
  if (error || !created) {
    return {
      message:
        error?.message === "midi_stem_limit_reached"
          ? "Your prototype stem library is full."
          : error?.message === "midi_stem_parent_not_found"
            ? "That exact stem version is no longer available to derive."
            : "We couldn’t create this private MIDI draft.",
    };
  }
  revalidatePath("/stems");
  redirect(`/stems/${created.stem_id}/edit`);
}

export async function saveMidiStemDraftAction(input: unknown) {
  const parsed = saveMidiStemDraftSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, code: "invalid_request" as const };
  const { content, ...command } = parsed.data;
  const canonicalContent = {
    ...content,
    notes: canonicalizeMidiNotes(content.notes),
  };
  const { data, error } = await saveMidiStemDraft({
    ...command,
    content: canonicalContent,
  });
  const saved = data?.[0];
  if (error || !saved) {
    return {
      ok: false as const,
      code:
        error?.message === "midi_stem_save_conflict"
          ? ("conflict" as const)
          : error?.message === "midi_stem_draft_not_found"
            ? ("not_found" as const)
            : error?.message?.startsWith("midi_stem_")
              ? ("invalid_request" as const)
              : ("unavailable" as const),
    };
  }
  return {
    ok: true as const,
    lockVersion: saved.lock_version,
    contentSha256: saved.content_sha256,
    updatedAt: saved.updated_at,
  };
}

export async function createImportedMidiStemAction(input: unknown) {
  const parsed = createImportedMidiStemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, code: "invalid_request" as const };
  }
  const content = {
    ...parsed.data.content,
    notes: canonicalizeMidiNotes(parsed.data.content.notes),
  };
  const { data: createdData, error: createError } =
    await createImportedMidiStemDraft({
      requestId: parsed.data.requestId,
      saveRequestId: parsed.data.saveRequestId,
      content,
    });
  const created = createdData?.[0];
  if (createError || !created) {
    return {
      ok: false as const,
      code:
        createError?.message === "midi_stem_limit_reached"
          ? ("limit" as const)
          : ("unavailable" as const),
    };
  }
  revalidatePath("/stems");
  return { ok: true as const, stemId: created.stem_id };
}

export async function publishMidiStemVersionAction(input: unknown) {
  const parsed = publishMidiStemVersionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, code: "invalid_request" as const };
  }
  const { data, error } = await publishMidiStemVersion(parsed.data);
  const published = data?.[0];
  if (error || !published) {
    return {
      ok: false as const,
      code:
        error?.message === "midi_stem_publish_conflict"
          ? ("conflict" as const)
          : error?.message === "midi_stem_version_limit_reached"
            ? ("limit" as const)
            : ("unavailable" as const),
    };
  }
  revalidatePath("/stems");
  return {
    ok: true as const,
    stemVersionId: published.stem_version_id,
    version: published.version,
    creatorCreditName: published.creator_credit_name,
  };
}

export async function getMidiStemVersionForDownloadAction(input: unknown) {
  const parsed = z.uuid().safeParse(input);
  if (!parsed.success) return { ok: false as const };
  const version = await getMidiStemVersion(parsed.data);
  if (!version) return { ok: false as const };
  return { ok: true as const, version };
}
