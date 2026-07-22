"use client";

import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { FiLoader, FiPause, FiPlay } from "react-icons/fi";
import { PatternRoll } from "./pattern-roll";
import type { MidiLibraryNote } from "./types";
import { PublicMidiPreviewRuntime } from "@/features/public-midi/preview-runtime.client";
import type { PublicMidiEvent } from "@/features/public-midi/schedule";

export const MIDI_PREVIEW_PLAY_EVENT = "openmidi:public-midi-preview-play";
type Status =
  "idle" | "loading" | "playing" | "paused" | "error" | "unavailable";

export function MidiLibraryPreview({
  listingId,
  patternVersionId,
  title,
  presetId,
  presetVersion,
  durationTicks,
  notes,
}: {
  listingId: string;
  patternVersionId: string;
  title: string;
  presetId: string;
  presetVersion: number;
  durationTicks: number;
  notes: MidiLibraryNote[];
}) {
  const instanceId = useId();
  const reduceMotion = useReducedMotion();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const runtime = useRef<PublicMidiPreviewRuntime | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playhead = useRef(0);
  const startedAt = useRef(0);
  const playheadAtStart = useRef(0);
  // The playhead position is a ref because playback reads it every frame, but
  // the sweep animation needs it at render time — so the value each run starts
  // from is mirrored into state rather than read out of the ref during render.
  const [sweepFromMs, setSweepFromMs] = useState(0);
  const durationMs = Math.ceil((durationTicks * 1000) / 960);
  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const pause = useCallback(() => {
    if (startedAt.current)
      playhead.current = Math.min(
        durationMs,
        playheadAtStart.current + performance.now() - startedAt.current,
      );
    startedAt.current = 0;
    runtime.current?.pause();
    clearTimer();
    setStatus((current) =>
      current === "playing"
        ? "paused"
        : current === "loading"
          ? "idle"
          : current,
    );
  }, [clearTimer, durationMs]);
  useEffect(() => {
    const other = (event: Event) => {
      const detail = (event as CustomEvent<{ instanceId: string }>).detail;
      if (detail.instanceId !== instanceId) pause();
    };
    window.addEventListener(MIDI_PREVIEW_PLAY_EVENT, other);
    return () => window.removeEventListener(MIDI_PREVIEW_PLAY_EVENT, other);
  }, [instanceId, pause]);
  useEffect(
    () => () => {
      clearTimer();
      runtime.current?.dispose();
    },
    [clearTimer],
  );
  const prepare = async () => {
    if (runtime.current) return;
    const events: PublicMidiEvent[] = notes.map((note) => ({
      eventId: `${listingId}:${note.noteId}`,
      trackId: listingId,
      clipId: listingId,
      midiPatternVersionId: patternVersionId,
      presetId,
      presetVersion,
      pitch: note.pitch,
      velocity: note.velocity,
      startTick: note.startTick,
      endTick: note.startTick + note.durationTicks,
      startSeconds: note.startTick / 960,
      durationSeconds: note.durationTicks / 960,
      gainDb: -6,
      pan: 0,
    }));
    const next = new PublicMidiPreviewRuntime();
    await next.prepare(events);
    runtime.current = next;
  };
  const play = async () => {
    const AudioContextConstructor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextConstructor) {
      setStatus("unavailable");
      setMessage("This browser cannot run the local MIDI preview.");
      return;
    }
    window.dispatchEvent(
      new CustomEvent(MIDI_PREVIEW_PLAY_EVENT, { detail: { instanceId } }),
    );
    setStatus("loading");
    setMessage(null);
    try {
      await prepare();
      if (playhead.current >= durationMs) playhead.current = 0;
      setSweepFromMs(playhead.current);
      await runtime.current!.play(playhead.current / 1000);
      playheadAtStart.current = playhead.current;
      startedAt.current = performance.now();
      timer.current = setTimeout(
        () => {
          runtime.current?.pause();
          playhead.current = 0;
          startedAt.current = 0;
          setStatus("idle");
        },
        durationMs - playhead.current + 80,
      );
      setStatus("playing");
    } catch {
      runtime.current?.pause();
      setStatus("error");
      setMessage("This browser-local MIDI preview is unavailable right now.");
    }
  };
  const playing = status === "playing",
    loading = status === "loading",
    unavailable = status === "unavailable";
  return (
    <div
      className="border-subtle bg-surface-soft/60 rounded-card mt-4 border p-3"
      data-preview-listing={listingId}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (playing ? pause() : void play())}
          disabled={loading || unavailable}
          className="cta-gradient text-accent-contrast inline-flex size-11 shrink-0 items-center justify-center rounded-full text-lg disabled:cursor-not-allowed disabled:opacity-55"
          aria-label={playing ? `Pause ${title}` : `Play ${title}`}
          title={
            unavailable
              ? "Web Audio unavailable"
              : playing
                ? "Pause preview"
                : "Play MIDI pattern"
          }
        >
          {loading ? (
            <FiLoader className="animate-spin" aria-hidden="true" />
          ) : playing ? (
            <FiPause aria-hidden="true" />
          ) : (
            <FiPlay className="ml-0.5" aria-hidden="true" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="relative">
            <PatternRoll
              notes={notes}
              durationTicks={durationTicks}
              className="h-9"
            />
            {/* Linear, always: easing belongs in the music, not the playhead. */}
            {playing && !reduceMotion && (
              <motion.span
                aria-hidden="true"
                className="bg-ink/90 absolute inset-y-0 w-px shadow-[0_0_8px_1px_rgb(247_239_233/0.5)]"
                initial={{ left: `${(sweepFromMs / durationMs) * 100}%` }}
                animate={{ left: "100%" }}
                transition={{
                  duration: Math.max((durationMs - sweepFromMs) / 1000, 0.1),
                  ease: "linear",
                }}
              />
            )}
          </div>
          <p className="text-muted mt-1.5 text-xs">
            {unavailable
              ? "Preview unavailable in this browser"
              : loading
                ? "Loading bundled synth…"
                : playing
                  ? "Now playing · 120 BPM preview"
                  : status === "paused"
                    ? "Paused"
                    : "Browser-local MIDI preview"}
          </p>
        </div>
      </div>
      {message && (
        <p className="text-danger mt-2 text-sm" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
