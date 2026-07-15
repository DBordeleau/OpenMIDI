"use client";

import {
  midiLocalRecoveryEnvelopeSchema,
  type MidiLocalRecoveryEnvelope,
} from "./schema";

const key = (viewerId: string, workspaceId: string) =>
  `jam-session:workspace:v2:${viewerId}:${workspaceId}`;

export function readMidiLocalRecovery(viewerId: string, workspaceId: string) {
  try {
    const raw = window.localStorage.getItem(key(viewerId, workspaceId));
    if (!raw) return null;
    const parsed = midiLocalRecoveryEnvelopeSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      window.localStorage.removeItem(key(viewerId, workspaceId));
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeMidiLocalRecovery(envelope: MidiLocalRecoveryEnvelope) {
  try {
    window.localStorage.setItem(
      key(envelope.viewerId, envelope.workspaceId),
      JSON.stringify(envelope),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearMidiLocalRecovery(viewerId: string, workspaceId: string) {
  try {
    window.localStorage.removeItem(key(viewerId, workspaceId));
  } catch {
    // Recovery storage is best effort and never replaces server authority.
  }
}
