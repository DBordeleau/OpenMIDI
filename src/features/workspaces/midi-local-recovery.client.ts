"use client";

import { z } from "zod";
import {
  midiLocalRecoveryEnvelopeSchema,
  type MidiLocalRecoveryEnvelope,
} from "./schema";

const key = (viewerId: string, workspaceId: string) =>
  `openmidi:workspace:v2:${viewerId}:${workspaceId}`;
const announcementKey = "openmidi:studio:draft-resolution-announcement";
const announcementSchema = z
  .object({
    projectId: z.uuid(),
    message: z.string().min(1).max(240),
  })
  .strict();

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

export function writeStudioResolutionAnnouncement(
  projectId: string,
  message: string,
) {
  try {
    const value = announcementSchema.parse({ projectId, message });
    window.sessionStorage.setItem(announcementKey, JSON.stringify(value));
  } catch {
    // Announcements are best effort and never affect the committed resolution.
  }
}

export function readStudioResolutionAnnouncement(projectId: string) {
  try {
    const raw = window.sessionStorage.getItem(announcementKey);
    if (!raw) return null;
    const parsed = announcementSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      window.sessionStorage.removeItem(announcementKey);
      return null;
    }
    if (parsed.data.projectId !== projectId) return null;
    window.sessionStorage.removeItem(announcementKey);
    return parsed.data.message;
  } catch {
    return null;
  }
}
