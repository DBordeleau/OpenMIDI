"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MidiStemVersion } from "@/features/midi/stems/types";
import { MidiStemEditor } from "@/features/midi/stems/stem-editor.client";
import type { MidiDraftSaveStatus } from "@/features/midi/stems/draft-autosave";
import type { MidiStemDraft } from "@/features/midi/stems/types";
import { MIDI_PPQ } from "../manifest/v2";
import { sha256PostgresJsonb } from "../manifest/schema";

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
      version: MidiStemVersion;
      startTick: number;
    };

export type FinalizePatternInput = {
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
};

export function IntegratedMidiComposer({
  target,
  ownerId,
  tempoBpm,
  timeSignature,
  onClose,
  onTransportStart,
  onTransportStop,
  onFinalize,
  onDraftStatusChange,
  onDraftOpened,
}: {
  target: IntegratedMidiTarget;
  ownerId: string;
  tempoBpm: number;
  timeSignature: { numerator: number; denominator: number };
  onClose: () => void;
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
  const lockVersion = useRef(1);

  const host = useMemo(
    () => ({
      tempoBpm,
      timeSignature,
      onTransportStart: (countInSeconds: number) =>
        onTransportStart(target.startTick, countInSeconds),
      onPlaybackTransportStart: (
        editorStartTick: number,
        countInSeconds: number,
      ) => onTransportStart(target.startTick + editorStartTick, countInSeconds),
      onTransportStop,
      onDraftStatusChange,
      persistDraft: async (content: {
        name: string;
        defaultPresetId: string;
        defaultPresetVersion: 1;
        ppq: 480;
        durationTicks: number;
        notes: MidiStemVersion["notes"];
      }) => ({
        ok: true,
        lockVersion: ++lockVersion.current,
        contentSha256: await sha256PostgresJsonb({
          ppq: content.ppq,
          durationTicks: content.durationTicks,
          notes: content.notes,
        }),
      }),
      finalize: (input: FinalizePatternInput) => onFinalize(input, target),
      finalizeLabel:
        target.operation === "replace"
          ? "Freeze and replace clip"
          : "Freeze and add pattern",
      onClose,
    }),
    [
      onClose,
      onDraftStatusChange,
      onFinalize,
      onTransportStart,
      onTransportStop,
      target,
      tempoBpm,
      timeSignature,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const name =
          target.operation === "replace"
            ? `${target.version.name} variation`
            : target.name;
        let presetId =
          target.operation === "replace"
            ? target.version.defaultPresetId
            : "warm-keys";
        let durationTicks =
          target.operation === "replace" ? target.version.durationTicks : 7680;
        let notes =
          target.operation === "replace" ? [...target.version.notes] : [];
        if (
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
        const now = new Date().toISOString();
        const contentSha256 = await sha256PostgresJsonb({
          ppq: MIDI_PPQ,
          durationTicks,
          notes,
        });
        if (cancelled) return;
        setDraft({
          draftId: crypto.randomUUID(),
          stemId: crypto.randomUUID(),
          ownerId,
          entryMode: target.operation === "replace" ? "derive" : "blank",
          parentStemVersionId:
            target.operation === "replace"
              ? target.version.stemVersionId
              : null,
          name,
          defaultPresetId: presetId,
          defaultPresetVersion: 1,
          ppq: MIDI_PPQ,
          durationTicks,
          notes,
          noteCount: notes.length,
          contentSha256,
          lockVersion: lockVersion.current,
          createdAt: now,
          updatedAt: now,
        });
        onDraftOpened();
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
  }, [onDraftOpened, ownerId, target]);

  return (
    <section
      className="rounded-card border-accent bg-surface flex min-h-0 flex-1 flex-col gap-3 border p-4 sm:px-6 sm:py-4"
      aria-labelledby="integrated-midi-heading"
    >
      <h2 id="integrated-midi-heading" className="sr-only">
        {target.operation === "replace"
          ? `Edit ${target.version.name}`
          : "Add a MIDI pattern"}
      </h2>
      {draft ? (
        <MidiStemEditor draft={draft} host={host} />
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
      {message && (
        <p role="status" className="text-muted text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
