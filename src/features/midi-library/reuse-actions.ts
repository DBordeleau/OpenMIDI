"use server";

import { revalidatePath } from "next/cache";
import {
  midiLibraryReuseCommandSchema,
  midiLibrarySavedCommandSchema,
} from "./schema";
import {
  getMidiLibraryExport,
  removeSavedMidiLibraryPattern,
  reuseMidiLibraryPattern,
  saveMidiLibraryPattern,
} from "@/server/repositories/midi-library";

export type MidiLibraryReuseActionResult =
  | { ok: true; message: string; href?: string }
  | { ok: false; code: string; message: string };

function failure(error: unknown): MidiLibraryReuseActionResult {
  const detail = error instanceof Error ? error.message : "";
  if (detail.includes("workspace_conflict"))
    return {
      ok: false,
      code: "conflict",
      message: "That workspace changed. Refresh its version before importing.",
    };
  if (detail.includes("source_not_found"))
    return {
      ok: false,
      code: "ineligible",
      message: "This exact source is no longer eligible for reuse.",
    };
  if (detail.includes("track_limit"))
    return {
      ok: false,
      code: "track_limit",
      message: "That workspace already has the maximum 16 tracks.",
    };
  return {
    ok: false,
    code: "unavailable",
    message:
      "That library action could not be completed. Nothing unsafe was changed.",
  };
}

export async function saveMidiLibraryPatternAction(
  input: unknown,
): Promise<MidiLibraryReuseActionResult> {
  const parsed = midiLibrarySavedCommandSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      code: "invalid_request",
      message: "That exact pattern version could not be identified.",
    };
  try {
    await saveMidiLibraryPattern(parsed.data);
    revalidatePath("/library");
    revalidatePath(`/library/${parsed.data.listingId}`);
    revalidatePath("/library/saved");
    return { ok: true, message: "Saved to your private clips." };
  } catch (error) {
    return failure(error);
  }
}

export async function removeSavedMidiLibraryPatternAction(
  input: unknown,
): Promise<MidiLibraryReuseActionResult> {
  const parsed = midiLibrarySavedCommandSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      code: "invalid_request",
      message: "That saved clip could not be identified.",
    };
  try {
    await removeSavedMidiLibraryPattern({
      patternVersionId: parsed.data.patternVersionId,
      requestId: parsed.data.requestId,
    });
    revalidatePath("/library");
    revalidatePath(`/library/${parsed.data.listingId}`);
    revalidatePath("/library/saved");
    return { ok: true, message: "Removed from your saved clips." };
  } catch (error) {
    return failure(error);
  }
}

export async function reuseMidiLibraryPatternAction(
  input: unknown,
): Promise<MidiLibraryReuseActionResult> {
  const parsed = midiLibraryReuseCommandSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      code: "invalid_request",
      message: "Choose an eligible private workspace and try again.",
    };
  try {
    const row = await reuseMidiLibraryPattern(parsed.data);
    revalidatePath("/library/saved");
    if (row.project_id) revalidatePath(`/studio/${row.project_id}`);
    if (parsed.data.operation === "import")
      return {
        ok: true,
        message: "Exact version imported into the private workspace.",
      };
    if (parsed.data.operation === "fork")
      return {
        ok: true,
        message: "Owned private copy created with its source credit intact.",
      };
    return {
      ok: true,
      message: "Owned private copy created. Opening the MIDI editor.",
      href: `/studio/${row.project_id}?editClip=${row.clip_id}`,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function getMidiLibraryExportAction(input: unknown) {
  const parsed = midiLibrarySavedCommandSchema
    .omit({ requestId: true })
    .safeParse(input);
  if (!parsed.success)
    return { ok: false as const, code: "invalid_request" as const };
  try {
    return { ok: true as const, data: await getMidiLibraryExport(parsed.data) };
  } catch {
    return { ok: false as const, code: "ineligible" as const };
  }
}
