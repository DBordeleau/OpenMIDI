import { beforeEach, describe, expect, it } from "vitest";
import {
  ensureMidiEditorFinalizationIntent,
  findLatestPendingMidiEditorDraft,
  midiEditorDeviceDraftKey,
  midiEditorDeviceDraftLimits,
  readMidiEditorDeviceDraft,
  writeMidiEditorDeviceDraft,
  type MidiEditorDraftTarget,
} from "./midi-editor-device-draft.client";

const uuid = (value: number) =>
  `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;
const viewerId = uuid(1);
const projectId = uuid(2);
const workspaceId = uuid(3);
const baseTarget: MidiEditorDraftTarget = {
  kind: "clip",
  viewerId,
  projectId,
  workspaceId,
  trackId: uuid(4),
  clipId: uuid(5),
  basePatternVersionId: uuid(6),
  baseContentSha256: "a".repeat(64),
  baseVersionNumber: 7,
};
const content = {
  name: "Night keys",
  defaultPresetId: "warm-keys",
  defaultPresetVersion: 1 as const,
  ppq: 480 as const,
  durationTicks: 1_920,
  notes: [
    {
      noteId: uuid(7),
      startTick: 0,
      durationTicks: 240,
      pitch: 60,
      velocity: 96,
    },
  ],
};
const contentFingerprint = "b".repeat(64);
const changedContentFingerprint = "c".repeat(64);

beforeEach(() => localStorage.clear());

describe("MIDI editor device drafts", () => {
  it("builds stable, collision-safe clip and pending keys", () => {
    expect(midiEditorDeviceDraftKey(baseTarget)).toBe(
      midiEditorDeviceDraftKey({ ...baseTarget }),
    );
    expect(
      new Set([
        midiEditorDeviceDraftKey(baseTarget),
        midiEditorDeviceDraftKey({ ...baseTarget, clipId: uuid(8) }),
        midiEditorDeviceDraftKey({ ...baseTarget, trackId: uuid(9) }),
        midiEditorDeviceDraftKey({
          kind: "pending",
          viewerId,
          projectId,
          workspaceId,
          trackId: baseTarget.trackId,
          name: "Pending keys",
          startTick: 480,
          entryMode: "blank",
        }),
      ]).size,
    ).toBe(4);
  });

  it("overwrites one record and advances its local lock", () => {
    const first = writeMidiEditorDeviceDraft({
      target: baseTarget,
      content,
      contentFingerprint,
      expectedLocalLockVersion: null,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = writeMidiEditorDeviceDraft({
      target: baseTarget,
      content: { ...content, name: "Night keys two" },
      contentFingerprint: changedContentFingerprint,
      expectedLocalLockVersion: first.record.localLockVersion,
    });
    expect(second.ok).toBe(true);
    expect(
      Array.from({ length: localStorage.length }, (_, index) =>
        localStorage.key(index),
      ).filter((key) => key?.startsWith("openmidi:midi-editor-draft:v2:")),
    ).toHaveLength(1);
    expect(readMidiEditorDeviceDraft(baseTarget)).toMatchObject({
      status: "matching",
      record: {
        localLockVersion: 2,
        content: { name: "Night keys two" },
      },
    });
  });

  it("removes invalid, oversized, and expired records while keeping stale authority explicit", () => {
    const key = midiEditorDeviceDraftKey(baseTarget);
    localStorage.setItem(key, "{broken");
    expect(readMidiEditorDeviceDraft(baseTarget)).toEqual({ status: "none" });
    expect(localStorage.getItem(key)).toBeNull();

    localStorage.setItem(
      key,
      "x".repeat(midiEditorDeviceDraftLimits.maxRecordBytes + 1),
    );
    expect(readMidiEditorDeviceDraft(baseTarget)).toEqual({ status: "none" });
    expect(localStorage.getItem(key)).toBeNull();

    const savedAt = new Date("2026-06-01T00:00:00.000Z");
    expect(
      writeMidiEditorDeviceDraft(
        {
          target: baseTarget,
          content,
          contentFingerprint,
          expectedLocalLockVersion: null,
        },
        { now: savedAt },
      ).ok,
    ).toBe(true);
    expect(
      readMidiEditorDeviceDraft(baseTarget, {
        now: new Date(
          savedAt.getTime() + midiEditorDeviceDraftLimits.maxAgeMs + 1,
        ),
      }),
    ).toEqual({ status: "none" });

    expect(
      writeMidiEditorDeviceDraft({
        target: baseTarget,
        content,
        contentFingerprint,
        expectedLocalLockVersion: null,
      }).ok,
    ).toBe(true);
    expect(
      readMidiEditorDeviceDraft({
        ...baseTarget,
        basePatternVersionId: uuid(99),
        baseVersionNumber: 8,
      }).status,
    ).toBe("stale");
  });

  it("evicts oldest records deterministically without touching workspace recovery", () => {
    localStorage.setItem(
      `openmidi:midi-workspace-recovery:v3:${viewerId}:${workspaceId}`,
      "workspace-envelope",
    );
    for (
      let index = 0;
      index < midiEditorDeviceDraftLimits.maxRecordsPerViewer + 1;
      index += 1
    ) {
      const target: MidiEditorDraftTarget = {
        kind: "pending",
        viewerId,
        projectId,
        workspaceId,
        trackId: uuid(100 + index),
        name: `Track ${index}`,
        startTick: index * 480,
        entryMode: "blank",
      };
      expect(
        writeMidiEditorDeviceDraft(
          {
            target,
            content: { ...content, name: `Track ${index}` },
            contentFingerprint: index.toString(16).padStart(64, "0"),
            expectedLocalLockVersion: null,
          },
          { now: new Date(Date.UTC(2026, 6, 1, 0, 0, index)) },
        ).ok,
      ).toBe(true);
    }

    const draftKeys = Array.from({ length: localStorage.length }, (_, index) =>
      localStorage.key(index),
    ).filter((key) => key?.startsWith("openmidi:midi-editor-draft:v2:"));
    expect(draftKeys).toHaveLength(
      midiEditorDeviceDraftLimits.maxRecordsPerViewer,
    );
    expect(
      localStorage.getItem(
        `openmidi:midi-workspace-recovery:v3:${viewerId}:${workspaceId}`,
      ),
    ).toBe("workspace-envelope");
    expect(
      findLatestPendingMidiEditorDraft({
        viewerId,
        projectId,
        workspaceId,
      })?.target,
    ).toMatchObject({ trackId: uuid(120), name: "Track 20" });
  });

  it("preserves a finalization intent for the same canonical content and invalidates it for changed content", () => {
    const initial = writeMidiEditorDeviceDraft({
      target: baseTarget,
      content,
      contentFingerprint,
      expectedLocalLockVersion: null,
    });
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    let nextUuid = 200;
    const randomUUID = () => uuid(nextUuid++);
    const first = ensureMidiEditorFinalizationIntent(
      {
        target: baseTarget,
        expectedLocalLockVersion: initial.record.localLockVersion,
        content,
        contentFingerprint,
      },
      { randomUUID },
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = ensureMidiEditorFinalizationIntent(
      {
        target: baseTarget,
        expectedLocalLockVersion: first.record.localLockVersion,
        content,
        contentFingerprint,
      },
      { randomUUID },
    );
    expect(second).toEqual(first);

    expect(
      ensureMidiEditorFinalizationIntent(
        {
          target: baseTarget,
          expectedLocalLockVersion: initial.record.localLockVersion,
          content,
          contentFingerprint,
        },
        { randomUUID },
      ),
    ).toEqual({ ok: false, code: "conflict" });

    const sameContentAutosave = writeMidiEditorDeviceDraft({
      target: baseTarget,
      content,
      contentFingerprint,
      expectedLocalLockVersion: first.record.localLockVersion,
    });
    expect(sameContentAutosave.ok).toBe(true);
    if (!sameContentAutosave.ok) return;
    expect(sameContentAutosave.record.finalizationIntent).toEqual(
      first.record.finalizationIntent,
    );

    const changedContentAutosave = writeMidiEditorDeviceDraft({
      target: baseTarget,
      content: { ...content, name: "Edited after failure" },
      contentFingerprint: changedContentFingerprint,
      expectedLocalLockVersion: sameContentAutosave.record.localLockVersion,
    });
    expect(changedContentAutosave.ok).toBe(true);
    if (!changedContentAutosave.ok) return;
    expect(changedContentAutosave.record.finalizationIntent).toBeNull();

    const changedContentIntent = ensureMidiEditorFinalizationIntent(
      {
        target: baseTarget,
        expectedLocalLockVersion:
          changedContentAutosave.record.localLockVersion,
        content: { ...content, name: "Edited after failure" },
        contentFingerprint: changedContentFingerprint,
      },
      { randomUUID },
    );
    expect(changedContentIntent.ok).toBe(true);
    if (changedContentIntent.ok)
      expect(changedContentIntent.record.finalizationIntent).not.toEqual(
        first.record.finalizationIntent,
      );
  });
});
