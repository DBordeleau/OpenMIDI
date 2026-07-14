"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canonicalizeMidiNotes } from "@/features/studio/manifest/v2";
import { createMidiStemDraftSchema, saveMidiStemDraftSchema } from "./schema";
import {
  createMidiStemDraft,
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
  revalidatePath("/stems");
  return {
    ok: true as const,
    lockVersion: saved.lock_version,
    contentSha256: saved.content_sha256,
    updatedAt: saved.updated_at,
  };
}
