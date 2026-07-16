"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MidiStemVersion } from "@/features/midi/stems/types";
import { MidiStemEditor } from "@/features/midi/stems/stem-editor.client";
import type { MidiDraftSaveStatus } from "@/features/midi/stems/draft-autosave";
import { MIDI_PPQ } from "../manifest/v2";
import {
  createIntegratedImportedMidiDraftAction,
  createIntegratedMidiDraftAction,
} from "./actions";
import type { MidiStemDraft } from "@/features/midi/stems/types";

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

type FinalizeInput = {
  draftId: string;
  expectedLockVersion: number;
  expectedContentSha256: string;
};

export function IntegratedMidiComposer({
  target,
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
  tempoBpm: number;
  timeSignature: { numerator: number; denominator: number };
  onClose: () => void;
  onTransportStart: (startTick: number, countInSeconds: number) => void;
  onTransportStop: () => void;
  onFinalize: (
    input: FinalizeInput,
    target: IntegratedMidiTarget,
  ) => Promise<{ ok: boolean; message: string }>;
  onDraftStatusChange: (status: MidiDraftSaveStatus) => void;
  onDraftOpened: () => void;
}) {
  const [draft, setDraft] = useState<MidiStemDraft | null>(null);
  const name =
    target.operation === "replace"
      ? `${target.version.name} variation`
      : target.name;
  const [message, setMessage] = useState("");
  const startedRef = useRef(false);
  const host = useMemo(
    () => ({
      tempoBpm,
      timeSignature,
      onTransportStart: (countInSeconds: number) =>
        onTransportStart(target.startTick, countInSeconds),
      onTransportStop,
      onDraftStatusChange,
      finalize: (input: FinalizeInput) => onFinalize(input, target),
      finalizeLabel:
        target.operation === "replace"
          ? "Save new version and replace clip"
          : "Save version and add to arrangement",
    }),
    [
      onDraftStatusChange,
      onFinalize,
      onTransportStart,
      onTransportStop,
      target,
      tempoBpm,
      timeSignature,
    ],
  );

  const createDraft = useCallback(async () => {
    setMessage("");
    const result = await createIntegratedMidiDraftAction({
      requestId: crypto.randomUUID(),
      name,
      parentStemVersionId:
        target.operation === "replace" ? target.version.stemVersionId : null,
    });
    if (result.ok) {
      setDraft(result.draft);
      onDraftOpened();
    } else
      setMessage(
        result.code === "parent_unavailable"
          ? "That exact version is no longer available to derive."
          : "The private MIDI draft could not be created.",
      );
  }, [name, onDraftOpened, target]);

  const importFile = useCallback(
    async (file: File) => {
      setMessage("");
      try {
        const { importMidiBytes } =
          await import("@/features/midi/interchange.client");
        const imported = importMidiBytes(
          new Uint8Array(await file.arrayBuffer()),
        );
        const result = await createIntegratedImportedMidiDraftAction({
          requestId: crypto.randomUUID(),
          saveRequestId: crypto.randomUUID(),
          content: {
            name,
            defaultPresetId: "warm-poly",
            defaultPresetVersion: 1,
            ppq: MIDI_PPQ,
            durationTicks: imported.durationTicks,
            notes: imported.notes.map((note) => ({
              ...note,
              noteId: crypto.randomUUID(),
            })),
          },
        });
        if (result.ok) {
          setDraft(result.draft);
          onDraftOpened();
          setMessage(
            imported.tempoBpm === tempoBpm
              ? imported.warnings.join(" ")
              : `Imported notes use project tempo ${tempoBpm} BPM. ${imported.warnings.join(" ")}`,
          );
        } else setMessage("That MIDI file could not become a private draft.");
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "MIDI import failed.",
        );
      }
    },
    [name, onDraftOpened, tempoBpm],
  );

  useEffect(() => {
    if (startedRef.current) return;
    const timeout = window.setTimeout(() => {
      if (startedRef.current) return;
      startedRef.current = true;
      if (target.operation === "add" && target.entry === "import" && target.file)
        void importFile(target.file);
      else void createDraft();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [createDraft, importFile, target]);

  return (
    <section
      className="rounded-card border-accent bg-surface flex min-h-0 flex-1 flex-col gap-3 border p-4 sm:px-6 sm:py-4"
      aria-labelledby="integrated-midi-heading"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-3">
          <p className="text-accent shrink-0 font-mono text-[10px] tracking-widest uppercase max-sm:hidden">
            MIDI editor
          </p>
          <h2
            id="integrated-midi-heading"
            className="truncate text-lg font-semibold"
          >
            {target.operation === "replace"
              ? `Edit ${target.version.name}`
              : "Add a MIDI part"}
          </h2>
          <span className="text-muted shrink-0 text-xs max-md:hidden">
            {tempoBpm} BPM · {timeSignature.numerator}/
            {timeSignature.denominator}
          </span>
        </div>
        <button
          type="button"
          className="border-strong hover:border-accent hover:text-accent min-h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors"
          onClick={onClose}
        >
          Close MIDI editor
        </button>
      </div>
      {draft ? (
        <MidiStemEditor draft={draft} host={host} />
      ) : (
        <div
          className="border-subtle bg-surface-soft rounded-control border p-6 text-center"
          role="status"
        >
          <p className="font-semibold">
            {target.operation === "add" && target.entry === "import"
              ? "Validating MIDI and preparing a private draft…"
              : target.operation === "replace"
                ? "Deriving an editable copy of this exact version…"
                : "Preparing the private piano-roll draft…"}
          </p>
          <p className="text-muted mt-1 text-sm">
            Raw MIDI bytes stay outside the arrangement manifest.
          </p>
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
