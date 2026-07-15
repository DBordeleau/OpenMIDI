"use client";

import { useEffect, useRef, useState } from "react";
import { FiDownload, FiPlay, FiSquare } from "react-icons/fi";
import { sanitizeFilenamePart } from "@/features/exports/filename";
import { MIDI_PPQ } from "@/features/studio/manifest/v2";
import type { PresetVoice } from "../browser-engine/preset-voice.client";
import { getMidiStemVersionForDownloadAction } from "./actions";

const VERSION_BPM = 120;
const buttonClass =
  "border-strong hover:border-accent inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold disabled:opacity-45";

export function MidiStemVersionActions({
  stemVersionId,
}: {
  stemVersionId: string;
}) {
  const [busy, setBusy] = useState<"play" | "download" | null>(null);
  const [message, setMessage] = useState("");
  const voiceRef = useRef<PresetVoice | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function stop() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    voiceRef.current?.allNotesOff();
    voiceRef.current?.dispose();
    voiceRef.current = null;
    setBusy(null);
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      voiceRef.current?.allNotesOff();
      voiceRef.current?.dispose();
    },
    [],
  );

  async function loadVersion() {
    const result = await getMidiStemVersionForDownloadAction(stemVersionId);
    if (!result.ok) throw new Error("midi_stem_version_unavailable");
    return result.version;
  }

  async function play() {
    stop();
    setBusy("play");
    setMessage("");
    try {
      const version = await loadVersion();
      if (!version.notes.length) {
        setMessage("This version has no notes to play.");
        setBusy(null);
        return;
      }
      const { createPresetVoice, resumeMidiAudioContext } =
        await import("../browser-engine/preset-voice.client");
      const now = await resumeMidiAudioContext();
      const voice = await createPresetVoice(
        version.defaultPresetId,
        version.defaultPresetVersion,
      );
      voiceRef.current = voice;
      const secondsPerTick = 60 / (VERSION_BPM * MIDI_PPQ);
      for (const note of version.notes) {
        voice.triggerAttackRelease(
          note.pitch,
          note.durationTicks * secondsPerTick,
          now + 0.05 + note.startTick * secondsPerTick,
          note.velocity / 127,
        );
      }
      const endTick = Math.max(
        ...version.notes.map((note) => note.startTick + note.durationTicks),
      );
      timerRef.current = setTimeout(
        stop,
        (0.05 + endTick * secondsPerTick + 1.5) * 1_000,
      );
    } catch {
      stop();
      setMessage("This exact version couldn’t be played right now.");
    }
  }

  async function download() {
    stop();
    setBusy("download");
    setMessage("");
    try {
      const version = await loadVersion();
      const { exportMidiStemVersion } = await import("../interchange.client");
      const bytes = exportMidiStemVersion(
        version,
        VERSION_BPM,
        version.creatorCreditName,
      );
      const blob = new Blob(
        [
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ) as ArrayBuffer,
        ],
        { type: "audio/midi" },
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${sanitizeFilenamePart(version.name, "midi-stem")}-v${version.version}.mid`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage("MIDI download prepared in this browser.");
    } catch {
      setMessage("This exact version couldn’t be downloaded right now.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {busy === "play" ? (
          <button type="button" className={buttonClass} onClick={stop}>
            <FiSquare aria-hidden /> Stop
          </button>
        ) : (
          <button
            type="button"
            className={buttonClass}
            disabled={busy !== null}
            onClick={() => void play()}
          >
            <FiPlay aria-hidden /> Play
          </button>
        )}
        <button
          type="button"
          className={buttonClass}
          disabled={busy !== null}
          onClick={() => void download()}
        >
          <FiDownload aria-hidden />
          {busy === "download" ? "Preparing…" : "Download .mid"}
        </button>
      </div>
      <p aria-live="polite" className="text-muted mt-2 min-h-5 text-sm">
        {message}
      </p>
    </div>
  );
}
