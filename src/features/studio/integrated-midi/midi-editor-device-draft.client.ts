"use client";

import { z } from "zod";
import {
  MAX_MIDI_STEM_DURATION_TICKS,
  MIDI_PPQ,
} from "@/features/studio/manifest/v2";
import {
  midiStemContentSchema,
  type MidiStemContent,
} from "@/features/midi/stems/schema";

const DEVICE_DRAFT_PREFIX = "openmidi:midi-editor-draft:v2:";
const DEVICE_DRAFT_VERSION = 2;
const DEVICE_DRAFT_LIMIT = 20;
const DEVICE_DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;
const DEVICE_DRAFT_MAX_BYTES = 512 * 1_024;
const DEVICE_DRAFT_VIEWER_MAX_BYTES = 4 * 1_024 * 1_024;
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

const commonTargetSchema = z.object({
  viewerId: z.uuid(),
  projectId: z.uuid(),
  workspaceId: z.uuid(),
  trackId: z.uuid(),
});

export const midiEditorDraftTargetSchema = z.discriminatedUnion("kind", [
  commonTargetSchema
    .extend({
      kind: z.literal("clip"),
      clipId: z.uuid(),
      basePatternVersionId: z.uuid(),
      baseContentSha256: sha256Schema,
      baseVersionNumber: z.number().int().positive(),
    })
    .strict(),
  commonTargetSchema
    .extend({
      kind: z.literal("pending"),
      name: z.string().trim().min(1).max(120),
      startTick: z
        .number()
        .int()
        .nonnegative()
        .max(MAX_MIDI_STEM_DURATION_TICKS),
      entryMode: z.enum(["blank", "import"]),
    })
    .strict(),
]);

const finalizationIntentSchema = z
  .object({
    patternRequestId: z.uuid(),
    versionRequestId: z.uuid(),
    trackId: z.uuid(),
    clipId: z.uuid(),
    contentFingerprint: sha256Schema,
  })
  .strict();

const deviceDraftRecordSchema = z
  .object({
    version: z.literal(DEVICE_DRAFT_VERSION),
    target: midiEditorDraftTargetSchema,
    localLockVersion: z.number().int().positive(),
    updatedAt: z.iso.datetime(),
    content: midiStemContentSchema,
    finalizationIntent: finalizationIntentSchema.nullable(),
  })
  .strict();

export type MidiEditorDraftTarget = z.infer<typeof midiEditorDraftTargetSchema>;
export type MidiEditorDeviceDraft = z.infer<typeof deviceDraftRecordSchema>;
export type MidiEditorFinalizationIntent = z.infer<
  typeof finalizationIntentSchema
>;

type DeviceDraftWriteResult =
  | { ok: true; record: MidiEditorDeviceDraft }
  | { ok: false; code: "conflict" | "invalid" | "oversized" | "storage" };

type StoredRecord = {
  key: string;
  record: MidiEditorDeviceDraft;
  bytes: number;
};

type DeviceDraftWriteInput = {
  target: MidiEditorDraftTarget;
  content: MidiStemContent;
  contentFingerprint: string;
  expectedLocalLockVersion: number | null;
};

function getStorage(storage?: Storage) {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function encodedBytes(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function targetSuffix(target: MidiEditorDraftTarget) {
  return target.kind === "clip"
    ? `clip:${target.trackId}:${target.clipId}`
    : `pending:${target.trackId}`;
}

export function midiEditorDeviceDraftKey(target: MidiEditorDraftTarget) {
  const parsed = midiEditorDraftTargetSchema.parse(target);
  return `${DEVICE_DRAFT_PREFIX}${parsed.viewerId}:${parsed.workspaceId}:${targetSuffix(parsed)}`;
}

function sameTargetIdentity(
  left: MidiEditorDraftTarget,
  right: MidiEditorDraftTarget,
) {
  if (
    left.kind !== right.kind ||
    left.viewerId !== right.viewerId ||
    left.projectId !== right.projectId ||
    left.workspaceId !== right.workspaceId ||
    left.trackId !== right.trackId
  )
    return false;
  return left.kind === "pending"
    ? true
    : right.kind === "clip" && left.clipId === right.clipId;
}

function sameTargetAuthority(
  left: MidiEditorDraftTarget,
  right: MidiEditorDraftTarget,
) {
  if (!sameTargetIdentity(left, right)) return false;
  if (left.kind === "pending") return true;
  return (
    right.kind === "clip" &&
    left.basePatternVersionId === right.basePatternVersionId &&
    left.baseContentSha256 === right.baseContentSha256
  );
}

function parseStoredRecord(
  storage: Storage,
  key: string,
  nowMs: number,
): StoredRecord | null {
  const raw = storage.getItem(key);
  if (!raw) return null;
  if (encodedBytes(raw) > DEVICE_DRAFT_MAX_BYTES) {
    storage.removeItem(key);
    return null;
  }
  try {
    const parsed = deviceDraftRecordSchema.safeParse(JSON.parse(raw));
    if (
      !parsed.success ||
      midiEditorDeviceDraftKey(parsed.data.target) !== key ||
      nowMs - Date.parse(parsed.data.updatedAt) > DEVICE_DRAFT_MAX_AGE_MS
    ) {
      storage.removeItem(key);
      return null;
    }
    return { key, record: parsed.data, bytes: encodedBytes(raw) };
  } catch {
    storage.removeItem(key);
    return null;
  }
}

function collectStoredRecords(storage: Storage, nowMs: number) {
  const keys = Array.from({ length: storage.length }, (_, index) =>
    storage.key(index),
  ).filter((key): key is string =>
    Boolean(key?.startsWith(DEVICE_DRAFT_PREFIX)),
  );
  return keys.flatMap((key) => {
    const stored = parseStoredRecord(storage, key, nowMs);
    return stored ? [stored] : [];
  });
}

function oldestFirst(left: StoredRecord, right: StoredRecord) {
  return (
    Date.parse(left.record.updatedAt) - Date.parse(right.record.updatedAt) ||
    left.key.localeCompare(right.key)
  );
}

function pruneViewerRecords(
  storage: Storage,
  viewerId: string,
  protectedKey: string,
  nowMs: number,
) {
  const records = collectStoredRecords(storage, nowMs)
    .filter(({ record }) => record.target.viewerId === viewerId)
    .sort(oldestFirst);
  let bytes = records.reduce((sum, record) => sum + record.bytes, 0);
  let count = records.length;
  for (const stored of records) {
    if (count <= DEVICE_DRAFT_LIMIT && bytes <= DEVICE_DRAFT_VIEWER_MAX_BYTES)
      break;
    if (stored.key === protectedKey) continue;
    storage.removeItem(stored.key);
    bytes -= stored.bytes;
    count -= 1;
  }
}

export function readMidiEditorDeviceDraft(
  expectedTarget: MidiEditorDraftTarget,
  options?: { storage?: Storage; now?: Date },
):
  | { status: "none" }
  | {
      status: "matching" | "stale";
      record: MidiEditorDeviceDraft;
    } {
  const storage = getStorage(options?.storage);
  if (!storage) return { status: "none" };
  try {
    const target = midiEditorDraftTargetSchema.parse(expectedTarget);
    const stored = parseStoredRecord(
      storage,
      midiEditorDeviceDraftKey(target),
      (options?.now ?? new Date()).getTime(),
    );
    if (!stored || !sameTargetIdentity(stored.record.target, target))
      return { status: "none" };
    return {
      status: sameTargetAuthority(stored.record.target, target)
        ? "matching"
        : "stale",
      record: stored.record,
    };
  } catch {
    return { status: "none" };
  }
}

function writeMidiEditorDeviceDraftRecord(
  input: DeviceDraftWriteInput & {
    finalizationIntent?: MidiEditorFinalizationIntent;
  },
  options?: { storage?: Storage; now?: Date },
): DeviceDraftWriteResult {
  const storage = getStorage(options?.storage);
  if (!storage) return { ok: false, code: "storage" };
  try {
    const target = midiEditorDraftTargetSchema.parse(input.target);
    const content = midiStemContentSchema.parse(input.content);
    const contentFingerprint = sha256Schema.parse(input.contentFingerprint);
    const key = midiEditorDeviceDraftKey(target);
    const now = options?.now ?? new Date();
    const current = parseStoredRecord(storage, key, now.getTime());
    if (
      current &&
      input.expectedLocalLockVersion !== current.record.localLockVersion
    )
      return { ok: false, code: "conflict" };
    if (!current && input.expectedLocalLockVersion !== null)
      return { ok: false, code: "conflict" };
    const finalizationIntent =
      input.finalizationIntent === undefined
        ? current?.record.finalizationIntent?.contentFingerprint ===
          contentFingerprint
          ? current.record.finalizationIntent
          : null
        : input.finalizationIntent;
    if (
      finalizationIntent &&
      finalizationIntent.contentFingerprint !== contentFingerprint
    )
      return { ok: false, code: "invalid" };
    const record = deviceDraftRecordSchema.parse({
      version: DEVICE_DRAFT_VERSION,
      target,
      localLockVersion: (current?.record.localLockVersion ?? 0) + 1,
      updatedAt: now.toISOString(),
      content,
      finalizationIntent,
    });
    const serialized = JSON.stringify(record);
    if (encodedBytes(serialized) > DEVICE_DRAFT_MAX_BYTES)
      return { ok: false, code: "oversized" };
    pruneViewerRecords(storage, target.viewerId, key, now.getTime());
    storage.setItem(key, serialized);
    pruneViewerRecords(storage, target.viewerId, key, now.getTime());
    return { ok: true, record };
  } catch (error) {
    return {
      ok: false,
      code: error instanceof z.ZodError ? "invalid" : "storage",
    };
  }
}

export function writeMidiEditorDeviceDraft(
  input: DeviceDraftWriteInput,
  options?: { storage?: Storage; now?: Date },
) {
  return writeMidiEditorDeviceDraftRecord(input, options);
}

export function clearMidiEditorDeviceDraft(
  target: MidiEditorDraftTarget,
  storage?: Storage,
) {
  const resolved = getStorage(storage);
  if (!resolved) return false;
  try {
    resolved.removeItem(midiEditorDeviceDraftKey(target));
    return true;
  } catch {
    return false;
  }
}

export function findLatestPendingMidiEditorDraft(
  input: { viewerId: string; projectId: string; workspaceId: string },
  options?: { storage?: Storage; now?: Date },
) {
  const storage = getStorage(options?.storage);
  if (!storage) return null;
  try {
    const viewerId = z.uuid().parse(input.viewerId);
    const projectId = z.uuid().parse(input.projectId);
    const workspaceId = z.uuid().parse(input.workspaceId);
    return (
      collectStoredRecords(storage, (options?.now ?? new Date()).getTime())
        .filter(
          ({ record }) =>
            record.target.kind === "pending" &&
            record.target.viewerId === viewerId &&
            record.target.projectId === projectId &&
            record.target.workspaceId === workspaceId,
        )
        .sort((left, right) => oldestFirst(right, left))[0]?.record ?? null
    );
  } catch {
    return null;
  }
}

export function ensureMidiEditorFinalizationIntent(
  input: {
    target: MidiEditorDraftTarget;
    expectedLocalLockVersion: number;
    content: MidiStemContent;
    contentFingerprint: string;
  },
  options?: { storage?: Storage; now?: Date; randomUUID?: () => string },
): DeviceDraftWriteResult {
  const current = readMidiEditorDeviceDraft(input.target, options);
  if (current.status !== "matching") return { ok: false, code: "conflict" };
  if (current.record.localLockVersion !== input.expectedLocalLockVersion)
    return { ok: false, code: "conflict" };
  const fingerprint = sha256Schema.safeParse(input.contentFingerprint);
  if (!fingerprint.success) return { ok: false, code: "invalid" };
  const existing = current.record.finalizationIntent;
  if (existing?.contentFingerprint === fingerprint.data)
    return { ok: true, record: current.record };
  const randomUUID = options?.randomUUID ?? (() => crypto.randomUUID());
  return writeMidiEditorDeviceDraftRecord(
    {
      target: input.target,
      content: input.content,
      contentFingerprint: fingerprint.data,
      expectedLocalLockVersion: input.expectedLocalLockVersion,
      finalizationIntent: {
        patternRequestId: randomUUID(),
        versionRequestId: randomUUID(),
        trackId: input.target.trackId,
        clipId:
          input.target.kind === "clip" ? input.target.clipId : randomUUID(),
        contentFingerprint: fingerprint.data,
      },
    },
    options,
  );
}

export const midiEditorDeviceDraftLimits = {
  version: DEVICE_DRAFT_VERSION,
  ppq: MIDI_PPQ,
  maxRecordsPerViewer: DEVICE_DRAFT_LIMIT,
  maxAgeMs: DEVICE_DRAFT_MAX_AGE_MS,
  maxRecordBytes: DEVICE_DRAFT_MAX_BYTES,
} as const;
