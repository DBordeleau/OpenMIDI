"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MIDI_PPQ } from "@/features/studio/manifest/v2";
import { SYNTH_PRESETS_V1, resolveSynthPreset } from "../presets";
import { createImportedMidiStemAction } from "./actions";
import type { MidiStemContent } from "./schema";

type PreparedImport = {
  sourceName: string;
  tempoBpm: number;
  durationTicks: number;
  notes: MidiStemContent["notes"];
  warnings: string[];
};

export function ImportMidiStemForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [prepared, setPrepared] = useState<PreparedImport | null>(null);
  const [name, setName] = useState("");
  const [presetId, setPresetId] = useState("warm-poly");
  const [message, setMessage] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function prepare(file: File | undefined) {
    setPrepared(null);
    setMessage("");
    if (!file) return;
    setPreparing(true);
    try {
      const { importMidiBytes } = await import("../interchange.client");
      const imported = importMidiBytes(
        new Uint8Array(await file.arrayBuffer()),
      );
      const notes = imported.notes.map((note) => ({
        noteId: crypto.randomUUID(),
        ...note,
      }));
      setPrepared({
        sourceName: file.name,
        tempoBpm: imported.tempoBpm,
        durationTicks: imported.durationTicks,
        notes,
        warnings: imported.warnings,
      });
      setName(imported.name);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "That MIDI file could not be prepared.",
      );
    } finally {
      setPreparing(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prepared || submitting) return;
    const preset = resolveSynthPreset(presetId, 1);
    if (
      prepared.notes.some(
        (note) => note.pitch < preset.minNote || note.pitch > preset.maxNote,
      )
    ) {
      setMessage(
        `${preset.name} cannot play every imported note. Choose a sound whose range covers the file.`,
      );
      return;
    }
    setSubmitting(true);
    setMessage("");
    const result = await createImportedMidiStemAction({
      requestId,
      saveRequestId: crypto.randomUUID(),
      content: {
        name,
        defaultPresetId: presetId,
        defaultPresetVersion: 1,
        ppq: MIDI_PPQ,
        durationTicks: prepared.durationTicks,
        notes: prepared.notes,
      },
    });
    if (!result.ok) {
      setMessage(
        result.code === "limit"
          ? "Your prototype stem library is full."
          : "We couldn’t save this imported MIDI draft. Try again.",
      );
      setSubmitting(false);
      return;
    }
    router.push(`/stems/${result.stemId}/edit`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-6">
      {message && (
        <p
          role="alert"
          className="border-danger text-danger rounded-control border p-3"
        >
          {message}
        </p>
      )}
      <label className="block font-semibold">
        Standard MIDI file
        <input
          required
          type="file"
          accept=".mid,.midi,audio/midi,audio/x-midi"
          className="focus:border-accent border-strong bg-surface rounded-control mt-2 min-h-11 w-full border px-3 py-2 transition-colors"
          onChange={(event) => void prepare(event.currentTarget.files?.[0])}
        />
      </label>
      {preparing && <p role="status">Reading MIDI notes locally…</p>}
      {prepared && (
        <div className="border-subtle bg-surface-soft rounded-control border p-4">
          <p className="font-semibold">Ready to create a private draft</p>
          <p className="text-muted mt-1 text-sm">
            {prepared.sourceName} · {prepared.notes.length.toLocaleString()}{" "}
            notes · {prepared.tempoBpm.toFixed(2)} BPM detected
          </p>
          <p className="text-muted mt-2 text-sm">
            The tempo initializes this import summary only. Standalone audition
            uses the editor’s fixed 120 BPM transport, and the original file is
            never uploaded.
          </p>
          {prepared.warnings.map((warning) => (
            <p key={warning} className="text-accent-2 mt-2 text-sm">
              {warning}
            </p>
          ))}
        </div>
      )}
      <label className="block font-semibold">
        Stem name
        <input
          required
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="focus:border-accent border-strong bg-surface rounded-control mt-2 min-h-11 w-full border px-3 py-2 transition-colors"
        />
      </label>
      <label className="block font-semibold">
        Default sound
        <select
          value={presetId}
          onChange={(event) => setPresetId(event.target.value)}
          className="focus:border-accent border-strong bg-surface rounded-control mt-2 min-h-11 w-full border px-3 py-2 transition-colors"
        >
          {SYNTH_PRESETS_V1.map((preset) => (
            <option key={preset.presetId} value={preset.presetId}>
              {preset.name} · notes {preset.minNote}–{preset.maxNote}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={!prepared || preparing || submitting || !name.trim()}
        className="cta-gradient text-accent-contrast inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-semibold transition-transform hover:-translate-y-px disabled:opacity-60"
      >
        {submitting ? "Saving imported notes…" : "Import into private draft"}
      </button>
    </form>
  );
}
