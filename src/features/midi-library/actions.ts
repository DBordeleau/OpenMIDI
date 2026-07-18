"use server";

import { revalidatePath } from "next/cache";
import {
  midiLibraryListingInputSchema,
  midiLibraryUnlistInputSchema,
} from "./schema";
import {
  listMidiLibraryPatternVersion,
  unlistMidiLibraryListing,
} from "@/server/repositories/midi-library";

export type MidiLibraryActionResult =
  | { ok: true; listingId: string; message: string }
  | { ok: false; code: string; message: string };

export async function listMidiLibraryAction(
  input: unknown,
): Promise<MidiLibraryActionResult> {
  const parsed = midiLibraryListingInputSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      code: "invalid_request",
      message:
        "Review the rights, source, credits, and musical details before listing.",
    };
  try {
    const result = await listMidiLibraryPatternVersion(parsed.data);
    revalidatePath("/library");
    revalidatePath("/library/manage");
    return {
      ok: true,
      listingId: result.listing_id,
      message: "Your exact pattern version is now listed.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("cc_downgrade"))
      return {
        ok: false,
        code: "cc_downgrade_denied",
        message: "A CC BY version cannot be changed to reference-only.",
      };
    if (message.includes("exact_version_rights_conflict"))
      return {
        ok: false,
        code: "exact_version_rights_conflict",
        message:
          "This exact version already has a permanent rights and credit record. Create a new version to change it.",
      };
    if (message.includes("commercial_license"))
      return {
        ok: false,
        code: "commercial_license_required",
        message:
          "Commercial listing requires this exact version to carry CC BY 4.0.",
      };
    if (message.includes("derived_rights_basis"))
      return {
        ok: false,
        code: "derived_rights_basis_required",
        message:
          "This pattern comes from a reusable source. List it as an authorized adaptation so its inherited attribution stays intact.",
      };
    if (message.includes("active_listing"))
      return {
        ok: false,
        code: "active_listing_conflict",
        message:
          "This pattern already has an active edition. Choose a newer version to replace it.",
      };
    return {
      ok: false,
      code: "unavailable",
      message: "We couldn’t publish this listing. Nothing was changed.",
    };
  }
}

export async function unlistMidiLibraryAction(
  input: unknown,
): Promise<MidiLibraryActionResult> {
  const parsed = midiLibraryUnlistInputSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      code: "invalid_request",
      message: "That listing could not be identified.",
    };
  try {
    const result = await unlistMidiLibraryListing(parsed.data);
    revalidatePath("/library");
    revalidatePath("/library/manage");
    return {
      ok: true,
      listingId: result.listing_id,
      message: "The listing is no longer discoverable.",
    };
  } catch {
    return {
      ok: false,
      code: "unavailable",
      message: "We couldn’t unlist that edition. Refresh and try again.",
    };
  }
}
