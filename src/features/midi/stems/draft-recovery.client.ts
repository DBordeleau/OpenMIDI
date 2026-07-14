import { z } from "zod";
import { midiStemContentSchema } from "./schema";

const recoverySchema = z
  .object({
    version: z.literal(1),
    ownerId: z.uuid(),
    draftId: z.uuid(),
    serverLockVersion: z.number().int().positive(),
    savedAt: z.iso.datetime(),
    state: z.enum(["pending", "conflict"]),
    content: midiStemContentSchema,
  })
  .strict();

export type MidiDraftRecovery = z.infer<typeof recoverySchema>;

function recoveryKey(ownerId: string, draftId: string) {
  return `jam-session:midi-draft-recovery:v1:${ownerId}:${draftId}`;
}

export function readMidiDraftRecovery(ownerId: string, draftId: string) {
  try {
    const value = localStorage.getItem(recoveryKey(ownerId, draftId));
    if (!value) return null;
    const parsed = recoverySchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeMidiDraftRecovery(recovery: MidiDraftRecovery) {
  try {
    localStorage.setItem(
      recoveryKey(recovery.ownerId, recovery.draftId),
      JSON.stringify(recoverySchema.parse(recovery)),
    );
  } catch {
    // Autosave remains authoritative when private browser storage is unavailable.
  }
}

export function clearMidiDraftRecovery(ownerId: string, draftId: string) {
  try {
    localStorage.removeItem(recoveryKey(ownerId, draftId));
  } catch {
    // A failed cleanup cannot weaken server-side draft authority.
  }
}
