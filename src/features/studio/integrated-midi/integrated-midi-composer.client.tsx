"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MidiDraftSaveStatus } from "@/features/midi/stems/draft-autosave";
import type { MidiStemContent } from "@/features/midi/stems/schema";
import { MidiStemEditor } from "@/features/midi/stems/stem-editor.client";
import type {
  MidiStemDraft,
  MidiStemVersion,
} from "@/features/midi/stems/types";
import { MIDI_PPQ } from "../manifest/v2";
import { sha256PostgresJsonb } from "../manifest/canonical-json";
import { DeviceDraftDiscardDialog } from "./device-draft-discard-dialog.client";
import {
  clearMidiEditorDeviceDraft,
  ensureMidiEditorFinalizationIntent,
  midiEditorDraftTargetSchema,
  readMidiEditorDeviceDraft,
  writeMidiEditorDeviceDraft,
  type MidiEditorDeviceDraft,
} from "./midi-editor-device-draft.client";

export type IntegratedMidiTarget =
  | {
      operation: "add";
      startTick: number;
      trackId: string;
      name: string;
      entry: "blank" | "import";
      file?: File;
    }
  | {
      operation: "replace";
      trackId: string;
      clipId: string;
      name: string;
      version: MidiStemVersion;
      startTick: number;
    };

export type FinalizePatternInput = {
  draftId: string;
  expectedLockVersion: number;
  expectedContentSha256: string;
  patternRequestId: string | null;
  versionRequestId: string | null;
  appliedTrackId: string;
  appliedClipId: string;
  content: {
    name: string;
    presetId: string;
    presetVersion: 1;
    ppq: 480;
    durationTicks: number;
    notes: MidiStemVersion["notes"];
  };
};

type DraftNotice =
  | { status: "restored"; record: MidiEditorDeviceDraft }
  | { status: "stale"; record: MidiEditorDeviceDraft };

export function IntegratedMidiComposer({
  target,
  ownerId,
  projectId,
  workspaceId,
  tempoBpm,
  timeSignature,
  onClose,
  onDiscard,
  onTransportStart,
  onTransportStop,
  onFinalize,
  onDraftStatusChange,
  onDraftOpened,
}: {
  target: IntegratedMidiTarget;
  ownerId: string;
  projectId: string;
  workspaceId: string;
  tempoBpm: number;
  timeSignature: { numerator: number; denominator: number };
  onClose: () => void;
  onDiscard: () => void;
  onTransportStart: (startTick: number, countInSeconds: number) => void;
  onTransportStop: () => void;
  onFinalize: (
    input: FinalizePatternInput,
    target: IntegratedMidiTarget,
  ) => Promise<{ ok: boolean; message: string }>;
  onDraftStatusChange: (status: MidiDraftSaveStatus) => void;
  onDraftOpened: () => void;
}) {
  const [draft, setDraft] = useState<MidiStemDraft | null>(null);
  const [message, setMessage] = useState("");
  const [draftNotice, setDraftNotice] = useState<DraftNotice | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [initialSaveState, setInitialSaveState] = useState<{
    status: MidiDraftSaveStatus;
    message: string;
  }>({ status: "saved", message: "Saved on this device" });
  const lockVersion = useRef(0);
  const callbacks = useRef({
    onClose,
    onDiscard,
    onTransportStart,
    onTransportStop,
    onFinalize,
    onDraftStatusChange,
    onDraftOpened,
  });
  useEffect(() => {
    callbacks.current = {
      onClose,
      onDiscard,
      onTransportStart,
      onTransportStop,
      onFinalize,
      onDraftStatusChange,
      onDraftOpened,
    };
  }, [
    onClose,
    onDiscard,
    onDraftOpened,
    onDraftStatusChange,
    onFinalize,
    onTransportStart,
    onTransportStop,
  ]);

  const deviceTarget = useMemo(
    () =>
      midiEditorDraftTargetSchema.parse(
        target.operation === "replace"
          ? {
              kind: "clip",
              viewerId: ownerId,
              projectId,
              workspaceId,
              trackId: target.trackId,
              clipId: target.clipId,
              basePatternVersionId: target.version.stemVersionId,
              baseContentSha256: target.version.contentSha256,
              baseVersionNumber: target.version.version,
            }
          : {
              kind: "pending",
              viewerId: ownerId,
              projectId,
              workspaceId,
              trackId: target.trackId,
              name: target.name,
              startTick: target.startTick,
              entryMode: target.entry,
            },
      ),
    [ownerId, projectId, target, workspaceId],
  );

  const host = useMemo(
    () => ({
      tempoBpm,
      timeSignature,
      initialSaveState,
      onTransportStart: (countInSeconds: number) =>
        callbacks.current.onTransportStart(target.startTick, countInSeconds),
      onPlaybackTransportStart: (
        editorStartTick: number,
        countInSeconds: number,
      ) =>
        callbacks.current.onTransportStart(
          target.startTick + editorStartTick,
          countInSeconds,
        ),
      onTransportStop: () => callbacks.current.onTransportStop(),
      onDraftStatusChange: (status: MidiDraftSaveStatus) =>
        callbacks.current.onDraftStatusChange(status),
      persistDraft: async (content: MidiStemContent) => {
        const contentFingerprint = await sha256PostgresJsonb(content);
        const result = writeMidiEditorDeviceDraft({
          target: deviceTarget,
          content,
          contentFingerprint,
          expectedLocalLockVersion: lockVersion.current || null,
        });
        if (!result.ok)
          return {
            ok: false,
            code: result.code === "conflict" ? "conflict" : "storage",
            lockVersion: lockVersion.current,
            contentSha256: "",
          } as const;
        lockVersion.current = result.record.localLockVersion;
        return {
          ok: true,
          lockVersion: result.record.localLockVersion,
          contentSha256: await sha256PostgresJsonb({
            ppq: content.ppq,
            durationTicks: content.durationTicks,
            notes: content.notes,
          }),
        } as const;
      },
      finalize: async (input: {
        draftId: string;
        expectedLockVersion: number;
        expectedContentSha256: string;
        content: {
          name: string;
          presetId: string;
          presetVersion: 1;
          ppq: 480;
          durationTicks: number;
          notes: MidiStemVersion["notes"];
        };
      }) => {
        const content: MidiStemContent = {
          name: input.content.name,
          defaultPresetId: input.content.presetId,
          defaultPresetVersion: input.content.presetVersion,
          ppq: input.content.ppq,
          durationTicks: input.content.durationTicks,
          notes: input.content.notes,
        };
        const musicallyIdentical =
          deviceTarget.kind === "clip" &&
          input.expectedContentSha256 === deviceTarget.baseContentSha256;
        let patternRequestId: string | null = null;
        let versionRequestId: string | null = null;
        let appliedClipId =
          deviceTarget.kind === "clip"
            ? deviceTarget.clipId
            : crypto.randomUUID();
        if (!musicallyIdentical) {
          const contentFingerprint = await sha256PostgresJsonb(content);
          const intent = ensureMidiEditorFinalizationIntent({
            target: deviceTarget,
            expectedLocalLockVersion: lockVersion.current,
            content,
            contentFingerprint,
          });
          if (!intent.ok || !intent.record.finalizationIntent)
            return {
              ok: false,
              message:
                "The apply intent could not be saved on this device. Your draft is still open.",
            };
          lockVersion.current = intent.record.localLockVersion;
          patternRequestId = intent.record.finalizationIntent.patternRequestId;
          versionRequestId = intent.record.finalizationIntent.versionRequestId;
          appliedClipId = intent.record.finalizationIntent.clipId;
        }
        const result = await callbacks.current.onFinalize(
          {
            ...input,
            patternRequestId,
            versionRequestId,
            appliedTrackId: deviceTarget.trackId,
            appliedClipId,
          },
          target,
        );
        if (result.ok) clearMidiEditorDeviceDraft(deviceTarget);
        return result;
      },
      finalizeLabel:
        target.operation === "replace"
          ? "Apply changes"
          : "Add pattern to arrangement",
      onClose: () => callbacks.current.onClose(),
    }),
    [deviceTarget, initialSaveState, target, tempoBpm, timeSignature],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = readMidiEditorDeviceDraft(deviceTarget);
        const name = target.name;
        let presetId =
          target.operation === "replace"
            ? target.version.defaultPresetId
            : "warm-keys";
        let durationTicks =
          target.operation === "replace" ? target.version.durationTicks : 7680;
        let notes =
          target.operation === "replace" ? [...target.version.notes] : [];
        if (
          stored.status === "none" &&
          target.operation === "add" &&
          target.entry === "import" &&
          target.file
        ) {
          const { importMidiBytes } =
            await import("@/features/midi/interchange.client");
          const imported = importMidiBytes(
            new Uint8Array(await target.file.arrayBuffer()),
          );
          presetId = imported.suggestedPreset.presetId;
          durationTicks = imported.durationTicks;
          notes = imported.notes.map((note) => ({
            ...note,
            noteId: crypto.randomUUID(),
          }));
          setMessage(imported.warnings.join(" "));
        }
        let content: MidiStemContent = {
          name,
          defaultPresetId: presetId,
          defaultPresetVersion: 1,
          ppq: MIDI_PPQ,
          durationTicks,
          notes,
        };
        if (stored.status === "matching") {
          content = stored.record.content;
          lockVersion.current = stored.record.localLockVersion;
          setDraftNotice({ status: "restored", record: stored.record });
        } else if (stored.status === "stale") {
          lockVersion.current = stored.record.localLockVersion;
          setDraftNotice({ status: "stale", record: stored.record });
        } else {
          const contentFingerprint = await sha256PostgresJsonb(content);
          const initial = writeMidiEditorDeviceDraft({
            target: deviceTarget,
            content,
            contentFingerprint,
            expectedLocalLockVersion: null,
          });
          if (initial.ok) {
            lockVersion.current = initial.record.localLockVersion;
          } else {
            setInitialSaveState({
              status: initial.code === "conflict" ? "conflict" : "error",
              message:
                initial.code === "conflict"
                  ? "Another tab updated this device draft. Reopen it to continue."
                  : "This draft is only in the current tab. Browser storage is unavailable.",
            });
          }
        }
        const contentSha256 = await sha256PostgresJsonb({
          ppq: content.ppq,
          durationTicks: content.durationTicks,
          notes: content.notes,
        });
        if (cancelled) return;
        const now = new Date().toISOString();
        setDraft({
          draftId: crypto.randomUUID(),
          stemId:
            target.operation === "replace"
              ? target.version.stemId
              : crypto.randomUUID(),
          ownerId,
          entryMode: target.operation === "replace" ? "derive" : target.entry,
          parentStemVersionId:
            target.operation === "replace"
              ? target.version.stemVersionId
              : null,
          ...content,
          noteCount: content.notes.length,
          contentSha256,
          lockVersion: lockVersion.current || 1,
          createdAt: now,
          updatedAt: now,
        });
        callbacks.current.onDraftOpened();
      } catch (error) {
        if (!cancelled)
          setMessage(
            error instanceof Error ? error.message : "MIDI import failed.",
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deviceTarget, ownerId, target]);

  async function recoverStaleDraft(record: MidiEditorDeviceDraft) {
    const contentFingerprint = await sha256PostgresJsonb(record.content);
    const recovered = writeMidiEditorDeviceDraft({
      target: deviceTarget,
      content: record.content,
      contentFingerprint,
      expectedLocalLockVersion: record.localLockVersion,
    });
    if (!recovered.ok) {
      setMessage(
        "That device draft could not be recovered. It remains stored for another try.",
      );
      return;
    }
    lockVersion.current = recovered.record.localLockVersion;
    const contentSha256 = await sha256PostgresJsonb({
      ppq: recovered.record.content.ppq,
      durationTicks: recovered.record.content.durationTicks,
      notes: recovered.record.content.notes,
    });
    const now = new Date().toISOString();
    setDraft((current) =>
      current
        ? {
            ...current,
            ...recovered.record.content,
            draftId: crypto.randomUUID(),
            noteCount: recovered.record.content.notes.length,
            contentSha256,
            lockVersion: recovered.record.localLockVersion,
            updatedAt: now,
          }
        : current,
    );
    setDraftNotice({ status: "restored", record: recovered.record });
  }

  return (
    <section
      className="rounded-card border-accent/60 bg-surface/40 flex min-h-0 flex-1 flex-col gap-3 border p-4 backdrop-blur-md sm:px-6 sm:py-4"
      aria-labelledby="integrated-midi-heading"
    >
      <h2 id="integrated-midi-heading" className="sr-only">
        {target.operation === "replace"
          ? `Edit ${target.name}`
          : "Add a MIDI pattern"}
      </h2>
      {draftNotice && (
        <div className="border-accent-2 bg-surface-soft rounded-control border p-3">
          <p className="font-semibold">
            {draftNotice.status === "restored"
              ? deviceTarget.kind === "clip"
                ? `Device draft restored · based on pattern version ${draftNotice.record.target.kind === "clip" ? draftNotice.record.target.baseVersionNumber : ""}`
                : "Device draft restored"
              : `A device draft based on pattern version ${draftNotice.record.target.kind === "clip" ? draftNotice.record.target.baseVersionNumber : "an earlier version"} is still available.`}
          </p>
          <p className="text-muted mt-1 text-sm">
            {draftNotice.status === "restored"
              ? "Continue where you left off, or discard only this browser-local copy."
              : "The current arrangement version opened by default. Recover the older draft explicitly or discard it."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {draftNotice.status === "stale" && (
              <button
                type="button"
                className="border-strong hover:border-accent min-h-11 rounded-full border px-4 text-sm font-semibold"
                onClick={() => void recoverStaleDraft(draftNotice.record)}
              >
                Recover device draft
              </button>
            )}
            <button
              type="button"
              className="border-strong hover:border-accent min-h-11 rounded-full border px-4 text-sm font-semibold"
              onClick={() => setDraftNotice(null)}
            >
              Continue editing
            </button>
            <button
              type="button"
              className="text-danger min-h-11 rounded-full px-4 text-sm font-semibold underline"
              onClick={() => setDiscardOpen(true)}
            >
              Discard device draft
            </button>
          </div>
        </div>
      )}
      {draft ? (
        <MidiStemEditor key={draft.draftId} draft={draft} host={host} />
      ) : (
        <div
          className="border-subtle bg-surface-soft rounded-control border p-6 text-center"
          role="status"
        >
          <p className="font-semibold">Preparing the private piano roll…</p>
          <button className="mt-3 underline" type="button" onClick={onClose}>
            Close MIDI editor
          </button>
        </div>
      )}
      <p className="text-muted text-center text-xs">
        Draft edits stay on this device. Applying changed MIDI creates a version
        in the arrangement.
      </p>
      {message && (
        <p role="status" className="text-muted text-sm">
          {message}
        </p>
      )}
      {discardOpen && (
        <DeviceDraftDiscardDialog
          onCancel={() => setDiscardOpen(false)}
          onConfirm={() => {
            clearMidiEditorDeviceDraft(deviceTarget);
            setDiscardOpen(false);
            callbacks.current.onDiscard();
          }}
        />
      )}
    </section>
  );
}
