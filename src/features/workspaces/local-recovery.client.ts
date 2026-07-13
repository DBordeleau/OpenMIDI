"use client";

import {
  localRecoveryEnvelopeSchema,
  type LocalRecoveryEnvelope,
} from "./schema";

const key = (viewerId: string, workspaceId: string) =>
  `jam-session:workspace:v1:${viewerId}:${workspaceId}`;

export function readLocalRecovery(viewerId: string, workspaceId: string) {
  try {
    const raw = window.localStorage.getItem(key(viewerId, workspaceId));
    if (!raw) return null;
    const parsed = localRecoveryEnvelopeSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      window.localStorage.removeItem(key(viewerId, workspaceId));
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeLocalRecovery(envelope: LocalRecoveryEnvelope) {
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

export function clearLocalRecovery(viewerId: string, workspaceId: string) {
  try {
    window.localStorage.removeItem(key(viewerId, workspaceId));
  } catch {
    // Recovery storage is a best-effort cache, never the server authority.
  }
}
