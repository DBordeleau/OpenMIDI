"use server";

import { freezeStudioPatternSchema } from "./schema";
import {
  createMidiPatternV3,
  createMidiPatternVersionV3,
  getMidiPatternVersionV3,
} from "@/server/repositories/midi-v3";
import { parseMidiPatternVersionV3 } from "../manifest/v3";

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
