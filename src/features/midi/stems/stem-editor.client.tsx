"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { FiPlay, FiPlus, FiSave, FiSquare, FiTrash2 } from "react-icons/fi";
import type { MidiNoteV1 } from "@/features/studio/manifest/v2";
import { canonicalizeMidiNotes, MIDI_PPQ } from "@/features/studio/manifest/v2";
import { SYNTH_PRESETS_V1, resolveSynthPreset } from "../presets";
import type { PresetVoice } from "../browser-engine/preset-voice.client";
import { saveMidiStemDraftAction } from "./actions";
import type { MidiStemDraft } from "./types";

const inputClass =
  "focus:border-accent border-strong bg-surface mt-2 min-h-11 w-full rounded-control border px-3 py-2 transition-colors";
const PLAYBACK_BPM = 120;

type SaveState =
  | { kind: "saved"; message: string }
  | { kind: "dirty"; message: string }
  | { kind: "saving"; message: string }
  | { kind: "conflict"; message: string }
  | { kind: "error"; message: string };

export function MidiStemEditor({ draft }: { draft: MidiStemDraft }) {
  const [name, setName] = useState(draft.name);
  const [presetId, setPresetId] = useState(draft.defaultPresetId);
  const [notes, setNotes] = useState(draft.notes);
  const [lockVersion, setLockVersion] = useState(draft.lockVersion);
  const [saveState, setSaveState] = useState<SaveState>({
    kind: "saved",
    message: "Draft loaded from your private library.",
  });
  const [playing, setPlaying] = useState(false);
  const [pending, startTransition] = useTransition();
  const voiceRef = useRef<PresetVoice | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preset = resolveSynthPreset(presetId, 1);

  const stopPlayback = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
    voiceRef.current?.allNotesOff();
    voiceRef.current?.dispose();
    voiceRef.current = null;
    setPlaying(false);
  }, []);

  useEffect(() => stopPlayback, [stopPlayback]);

  const markDirty = (message = "Unsaved changes.") =>
    setSaveState({ kind: "dirty", message });

  function addNote(formData: FormData) {
    if (notes.length >= 2_048) {
      setSaveState({
        kind: "error",
        message: "This stem has reached 2,048 notes.",
      });
      return;
    }
    const note = {
      noteId: crypto.randomUUID(),
      pitch: Number(formData.get("pitch")),
      velocity: Number(formData.get("velocity")),
      startTick: Number(formData.get("startTick")),
      durationTicks: Number(formData.get("durationTicks")),
    } satisfies MidiNoteV1;
    if (
      !Number.isInteger(note.pitch) ||
      note.pitch < preset.minNote ||
      note.pitch > preset.maxNote ||
      !Number.isInteger(note.velocity) ||
      note.velocity < 1 ||
      note.velocity > 127 ||
      !Number.isInteger(note.startTick) ||
      note.startTick < 0 ||
      !Number.isInteger(note.durationTicks) ||
      note.durationTicks < 1 ||
      note.startTick + note.durationTicks > draft.durationTicks
    ) {
      setSaveState({
        kind: "error",
        message: "Check the note pitch, timing, and velocity.",
      });
      return;
    }
    setNotes((current) => canonicalizeMidiNotes([...current, note]));
    markDirty("Note added. Save when the phrase feels right.");
  }

  function addStarterPattern() {
    const pitches =
      preset.family === "drums"
        ? [36, 42, 38, 42]
        : [
            preset.minNote + 12,
            preset.minNote + 16,
            preset.minNote + 19,
            preset.minNote + 24,
          ];
    const starter = pitches.map((pitch, index): MidiNoteV1 => ({
      noteId: crypto.randomUUID(),
      pitch: Math.min(preset.maxNote, pitch),
      velocity: index % 2 === 0 ? 100 : 84,
      startTick: index * MIDI_PPQ,
      durationTicks: preset.family === "drums" ? 120 : MIDI_PPQ,
    }));
    setNotes(canonicalizeMidiNotes(starter));
    markDirty("Starter pattern added. Shape it with the note controls.");
  }

  async function play() {
    if (notes.length === 0) {
      setSaveState({
        kind: "error",
        message: "Add a note before pressing play.",
      });
      return;
    }
    stopPlayback();
    setPlaying(true);
    try {
      const { createPresetVoice, resumeMidiAudioContext } =
        await import("../browser-engine/preset-voice.client");
      await resumeMidiAudioContext();
      const voice = await createPresetVoice(presetId, 1);
      voiceRef.current = voice;
      const now = (await resumeMidiAudioContext()) + 0.05;
      const secondsPerTick = 60 / (PLAYBACK_BPM * MIDI_PPQ);
      for (const note of notes) {
        voice.triggerAttackRelease(
          note.pitch,
          note.durationTicks * secondsPerTick,
          now + note.startTick * secondsPerTick,
          note.velocity / 127,
        );
      }
      const endTick = Math.max(
        ...notes.map((note) => note.startTick + note.durationTicks),
      );
      stopTimerRef.current = setTimeout(
        stopPlayback,
        (endTick * secondsPerTick + 1.5) * 1_000,
      );
    } catch {
      stopPlayback();
      setSaveState({
        kind: "error",
        message:
          "Playback couldn’t start. Check browser audio permission and try again.",
      });
    }
  }

  function save() {
    setSaveState({ kind: "saving", message: "Saving your private draft…" });
    startTransition(async () => {
      const canonicalNotes = canonicalizeMidiNotes(notes);
      const result = await saveMidiStemDraftAction({
        draftId: draft.draftId,
        requestId: crypto.randomUUID(),
        expectedLockVersion: lockVersion,
        content: {
          name,
          defaultPresetId: presetId,
          defaultPresetVersion: 1,
          ppq: MIDI_PPQ,
          durationTicks: draft.durationTicks,
          notes: canonicalNotes,
        },
      });
      if (result.ok) {
        setNotes(canonicalNotes);
        setLockVersion(result.lockVersion);
        setSaveState({ kind: "saved", message: "Saved to My stems." });
      } else if (result.code === "conflict") {
        setSaveState({
          kind: "conflict",
          message:
            "Another tab saved this draft first. Reload before continuing.",
        });
      } else {
        setSaveState({
          kind: "error",
          message:
            result.code === "invalid_request"
              ? "Check the stem name, preset, and note boundaries."
              : "The draft couldn’t be saved. Your notes remain in this tab.",
        });
      }
    });
  }

  return (
    <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="rounded-card border-subtle bg-surface shadow-raised border p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <label className="min-w-64 flex-1 font-semibold">
            Stem name
            <input
              className={inputClass}
              value={name}
              maxLength={120}
              onChange={(event) => {
                setName(event.target.value);
                markDirty();
              }}
            />
          </label>
          <label className="min-w-56 font-semibold">
            Sound
            <select
              className={inputClass}
              value={presetId}
              onChange={(event) => {
                stopPlayback();
                setPresetId(event.target.value);
                setNotes([]);
                markDirty(
                  "Sound changed. Notes were cleared to keep its playable range exact.",
                );
              }}
            >
              {SYNTH_PRESETS_V1.map((item) => (
                <option key={item.presetId} value={item.presetId}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-muted mt-3 text-sm">{preset.description}</p>

        <div className="border-subtle mt-6 flex flex-wrap gap-3 border-y py-4">
          <button
            type="button"
            onClick={() => void play()}
            disabled={playing}
            className="cta-gradient text-accent-contrast inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-60"
          >
            <FiPlay aria-hidden /> {playing ? "Playing…" : "Play stem"}
          </button>
          <button
            type="button"
            onClick={stopPlayback}
            disabled={!playing}
            className="border-strong hover:border-accent inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-sm font-semibold disabled:opacity-50"
          >
            <FiSquare aria-hidden /> Stop
          </button>
          <button
            type="button"
            onClick={save}
            disabled={
              pending || saveState.kind === "saved" || name.trim().length === 0
            }
            className="border-strong hover:border-accent inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-sm font-semibold disabled:opacity-50"
          >
            <FiSave aria-hidden /> {pending ? "Saving…" : "Save draft"}
          </button>
        </div>

        <div
          aria-live="polite"
          className={`mt-4 text-sm ${saveState.kind === "error" || saveState.kind === "conflict" ? "text-danger" : "text-muted"}`}
        >
          Status: {saveState.message}
          {saveState.kind === "conflict" && (
            <button
              type="button"
              className="text-accent ml-2 underline"
              onClick={() => window.location.reload()}
            >
              Reload draft
            </button>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Notes</h2>
            <p className="text-muted mt-1 text-sm">
              {notes.length} of 2,048 notes · 480 ticks per beat · playback at{" "}
              {PLAYBACK_BPM} BPM
            </p>
          </div>
          <button
            type="button"
            onClick={addStarterPattern}
            className="border-strong hover:border-accent inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold"
          >
            <FiPlus aria-hidden /> Add starter pattern
          </button>
        </div>

        {notes.length ? (
          <ul className="mt-4 grid gap-2">
            {notes.map((note, index) => (
              <li
                key={note.noteId}
                className="border-subtle bg-surface-soft rounded-control flex flex-wrap items-center justify-between gap-3 border px-4 py-3"
              >
                <span className="font-mono text-sm">
                  Note {index + 1}: pitch {note.pitch}, tick {note.startTick},
                  length {note.durationTicks}, velocity {note.velocity}
                </span>
                <button
                  type="button"
                  aria-label={`Delete note ${index + 1}`}
                  title={`Delete note ${index + 1}`}
                  onClick={() => {
                    setNotes((current) =>
                      current.filter((item) => item.noteId !== note.noteId),
                    );
                    markDirty("Note removed.");
                  }}
                  className="text-muted hover:text-danger inline-flex min-h-11 min-w-11 items-center justify-center rounded-full"
                >
                  <FiTrash2 aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="border-strong bg-surface-soft rounded-card mt-4 border border-dashed p-8 text-center">
            <p className="font-semibold">A quiet canvas.</p>
            <p className="text-muted mt-2 text-sm">
              Add one note below or begin with a four-note pattern.
            </p>
          </div>
        )}
      </div>

      <aside className="rounded-card border-subtle bg-surface h-fit border p-5">
        <h2 className="text-lg font-semibold">Add one note</h2>
        <p className="text-muted mt-2 text-sm">
          This foundation uses exact numeric controls. The accessible piano roll
          arrives in MIDI-03.
        </p>
        <form action={addNote} className="mt-5 grid gap-4">
          <label className="text-sm font-semibold">
            MIDI pitch ({preset.minNote}–{preset.maxNote})
            <input
              className={inputClass}
              name="pitch"
              type="number"
              min={preset.minNote}
              max={preset.maxNote}
              defaultValue={Math.min(
                preset.maxNote,
                Math.max(preset.minNote, 60),
              )}
              required
            />
          </label>
          <label className="text-sm font-semibold">
            Start tick
            <input
              className={inputClass}
              name="startTick"
              type="number"
              min={0}
              max={draft.durationTicks - 1}
              step={1}
              defaultValue={notes.length * MIDI_PPQ}
              required
            />
          </label>
          <label className="text-sm font-semibold">
            Duration ticks
            <input
              className={inputClass}
              name="durationTicks"
              type="number"
              min={1}
              max={draft.durationTicks}
              step={1}
              defaultValue={MIDI_PPQ}
              required
            />
          </label>
          <label className="text-sm font-semibold">
            Velocity
            <input
              className={inputClass}
              name="velocity"
              type="number"
              min={1}
              max={127}
              step={1}
              defaultValue={96}
              required
            />
          </label>
          <button className="cta-gradient text-accent-contrast inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold">
            <FiPlus aria-hidden /> Add note
          </button>
        </form>
      </aside>
    </section>
  );
}
