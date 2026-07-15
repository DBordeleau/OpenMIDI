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
  const [name, setName] = useState(
    target.operation === "replace"
      ? `${target.version.name} variation`
      : target.name,
  );
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
    setMessage("");
    try {
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
    } finally {
      setBusy(false);
    }
  }, [name, onDraftOpened, target]);

  const importFile = useCallback(
    async (file: File) => {
      setBusy(true);
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
      } finally {
        setBusy(false);
      }
    },
    [name, onDraftOpened, tempoBpm],
  );

  useEffect(() => {
    if (target.operation !== "add" || startedRef.current) return;
    const timeout = window.setTimeout(() => {
      if (startedRef.current) return;
      startedRef.current = true;
      if (target.entry === "import" && target.file)
        void importFile(target.file);
      else void createDraft();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [createDraft, importFile, target]);

  return (
    <section
      className="rounded-card border-accent bg-surface space-y-4 border p-4 sm:p-6"
      aria-labelledby="integrated-midi-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-accent font-mono text-xs tracking-widest uppercase">
            Project MIDI editor
          </p>
          <h2
            id="integrated-midi-heading"
            className="mt-1 text-2xl font-semibold"
          >
            {target.operation === "replace"
              ? `Edit ${target.version.name}`
              : "Add a MIDI part"}
          </h2>
          <p className="text-muted mt-1 text-sm">
            Note draft autosave is separate from arrangement autosave. Playback
            and recording follow {tempoBpm} BPM · {timeSignature.numerator}/
            {timeSignature.denominator} project time.
          </p>
        </div>
        <button
          type="button"
          className="border-strong min-h-11 rounded-full border px-4 text-sm font-semibold"
          onClick={onClose}
        >
          Close MIDI editor
        </button>
      </div>
      {!draft && target.operation === "replace" ? (
        <div className="border-subtle bg-surface-soft rounded-control space-y-3 border p-4">
          <label className="block text-sm font-semibold">
            Private stem name
            <input
              className="border-strong bg-canvas rounded-control mt-2 min-h-11 w-full border px-3"
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="cta-gradient text-accent-contrast min-h-11 rounded-full px-5 text-sm font-semibold disabled:opacity-50"
              disabled={busy || !name.trim()}
              onClick={() => void createDraft()}
            >
              {busy ? "Preparing draft…" : "Derive exact version"}
            </button>
          </div>
        </div>
      ) : draft ? (
        <MidiStemEditor draft={draft} host={host} />
      ) : (
        <div
          className="border-subtle bg-surface-soft rounded-control border p-6 text-center"
          role="status"
        >
          <p className="font-semibold">
            {target.operation === "add" && target.entry === "import"
              ? "Validating MIDI and preparing a private draftâ€¦"
              : "Preparing the private piano-roll draftâ€¦"}
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
