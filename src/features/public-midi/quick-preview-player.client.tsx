"use client";

import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { FiLoader, FiPause, FiPlay } from "react-icons/fi";
import {
  publicMidiPreviewResponseSchema,
  type MidiArrangementPreview,
} from "./contract";
import { PublicMidiPreviewRuntime } from "./preview-runtime.client";
import { schedulePublicMidiRevision } from "./schedule";

const PREVIEW_PLAY_EVENT = "openmidi:public-midi-preview-play";
const BAR_HEIGHTS = [
  36, 58, 82, 48, 72, 94, 62, 42, 76, 54, 88, 66, 44, 80, 60, 92, 52, 70,
];
type PreviewStatus = "idle" | "loading" | "playing" | "paused" | "error";

export function PublicMidiQuickPreview({
  projectId,
  revisionId,
  title,
  durationMs,
  compact = false,
  inline = false,
  previewEndpoint,
}: {
  projectId?: string;
  revisionId?: string;
  title: string;
  durationMs: number;
  compact?: boolean;
  inline?: boolean;
  previewEndpoint?: string;
}) {
  const instanceId = useId();
  const reduceMotion = useReducedMotion();
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const dataRef = useRef<MidiArrangementPreview | null>(null);
  const runtimeRef = useRef<PublicMidiPreviewRuntime | null>(null);
  const playheadMs = useRef(0);
  const playheadAtStartMs = useRef(0);
  const startedAt = useRef(0);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);

  const clearEndTimer = useCallback(() => {
    if (endTimer.current) clearTimeout(endTimer.current);
    endTimer.current = null;
  }, []);

  const pause = useCallback(() => {
    request.current?.abort();
    request.current = null;
    if (startedAt.current > 0) {
      playheadMs.current = Math.min(
        durationMs,
        playheadAtStartMs.current +
          Math.max(0, performance.now() - startedAt.current),
      );
    }
    startedAt.current = 0;
    runtimeRef.current?.pause();
    clearEndTimer();
    setStatus((current) =>
      current === "playing"
        ? "paused"
        : current === "loading"
          ? "idle"
          : current,
    );
  }, [clearEndTimer, durationMs]);

  useEffect(() => {
    const handleOtherPreview = (event: Event) => {
      const detail = (event as CustomEvent<{ instanceId: string }>).detail;
      if (detail.instanceId !== instanceId) pause();
    };
    window.addEventListener(PREVIEW_PLAY_EVENT, handleOtherPreview);
    return () =>
      window.removeEventListener(PREVIEW_PLAY_EVENT, handleOtherPreview);
  }, [instanceId, pause]);

  useEffect(
    () => () => {
      request.current?.abort();
      clearEndTimer();
      runtimeRef.current?.dispose();
    },
    [clearEndTimer],
  );

  const load = useCallback(async () => {
    if (dataRef.current && runtimeRef.current) return dataRef.current;
    const controller = new AbortController();
    request.current = controller;
    const response = await fetch(
      previewEndpoint ??
        `/api/projects/${projectId}/revisions/${revisionId}/preview`,
      { method: "POST", cache: "no-store", signal: controller.signal },
    );
    if (!response.ok) throw new Error("Preview unavailable");
    const data = publicMidiPreviewResponseSchema.parse(await response.json());
    if (
      (projectId && data.projectId !== projectId) ||
      (revisionId && data.revisionId !== revisionId)
    ) {
      throw new Error("Preview changed");
    }
    const patterns = new Map(
      data.patternVersions.map((pattern) => [
        pattern.midiPatternVersionId,
        pattern,
      ]),
    );
    const runtime = new PublicMidiPreviewRuntime();
    await runtime.prepare(schedulePublicMidiRevision(data.manifest, patterns));
    runtimeRef.current?.dispose();
    runtimeRef.current = runtime;
    dataRef.current = data;
    request.current = null;
    return data;
  }, [previewEndpoint, projectId, revisionId]);

  const play = async () => {
    window.dispatchEvent(
      new CustomEvent(PREVIEW_PLAY_EVENT, { detail: { instanceId } }),
    );
    setStatus("loading");
    setMessage(null);
    try {
      await load();
      if (playheadMs.current >= durationMs) playheadMs.current = 0;
      await runtimeRef.current!.play(playheadMs.current / 1_000);
      playheadAtStartMs.current = playheadMs.current;
      startedAt.current = performance.now();
      endTimer.current = setTimeout(
        () => {
          runtimeRef.current?.pause();
          playheadMs.current = 0;
          startedAt.current = 0;
          setStatus("idle");
        },
        durationMs - playheadMs.current + 80,
      );
      setStatus("playing");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      runtimeRef.current?.pause();
      setStatus("error");
      setMessage(
        "This MIDI preview couldn’t be loaded. Try again in a moment.",
      );
    }
  };

  const isPlaying = status === "playing";
  const isLoading = status === "loading";
  const buttonLabel =
    status === "error"
      ? `Retry ${title}`
      : isPlaying
        ? `Pause ${title}`
        : `Play ${title}`;
  const statusLabel = isLoading
    ? "Loading MIDI…"
    : isPlaying
      ? "Now playing"
      : status === "paused"
        ? "Paused"
        : status === "error"
          ? "Try again"
          : inline
            ? "Play preview"
            : "MIDI arrangement";

  if (inline) {
    return (
      <div className="min-w-0" data-preview-status={status}>
        <div
          className={`border-subtle bg-surface-soft flex min-h-12 w-full min-w-44 items-center gap-2 rounded-full border p-1.5 pr-3 transition-colors sm:w-auto ${isPlaying ? "border-accent/60 bg-accent/8" : ""}`}
        >
          <button
            type="button"
            className="cta-gradient text-accent-contrast inline-flex size-11 shrink-0 items-center justify-center rounded-full text-lg transition-transform hover:-translate-y-px disabled:cursor-wait disabled:opacity-70"
            onClick={() => (isPlaying ? pause() : void play())}
            disabled={isLoading}
            aria-label={buttonLabel}
            aria-pressed={isPlaying}
            title={
              status === "error"
                ? "Retry MIDI preview"
                : isPlaying
                  ? "Pause preview"
                  : "Play MIDI arrangement"
            }
          >
            {isLoading ? (
              <FiLoader className="animate-spin" aria-hidden="true" />
            ) : isPlaying ? (
              <FiPause aria-hidden="true" />
            ) : (
              <FiPlay className="ml-0.5" aria-hidden="true" />
            )}
          </button>
          <span className="min-w-0 leading-tight">
            <span
              className={`block truncate text-sm font-semibold ${isPlaying ? "text-accent" : "text-ink"}`}
            >
              {statusLabel}
            </span>
            <span className="text-muted mt-0.5 block font-mono text-[10px] tracking-wider uppercase">
              {formatDuration(durationMs)}
            </span>
          </span>
        </div>
        {message && (
          <p className="text-danger mt-1.5 max-w-52 text-xs" role="alert">
            Preview unavailable. Press retry to try again.
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`border-subtle bg-surface-soft rounded-card border ${compact ? "mt-5 p-3" : "mt-6 p-4 sm:p-5"}`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="cta-gradient text-accent-contrast inline-flex size-11 shrink-0 items-center justify-center rounded-full text-lg transition-transform hover:-translate-y-px disabled:cursor-wait disabled:opacity-70"
          onClick={() => (isPlaying ? pause() : void play())}
          disabled={isLoading}
          aria-label={buttonLabel}
          title={isPlaying ? "Pause preview" : "Play MIDI arrangement"}
        >
          {isLoading ? (
            <FiLoader className="animate-spin" aria-hidden="true" />
          ) : isPlaying ? (
            <FiPause aria-hidden="true" />
          ) : (
            <FiPlay className="ml-0.5" aria-hidden="true" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex h-10 items-center gap-1" aria-hidden="true">
            {BAR_HEIGHTS.map((height, index) => (
              <motion.span
                key={index}
                className={
                  index % 4 === 0
                    ? "bg-accent-2 w-1 flex-1 rounded-full"
                    : "bg-accent w-1 flex-1 rounded-full"
                }
                style={{ height: `${height}%`, transformOrigin: "center" }}
                animate={
                  isPlaying && !reduceMotion
                    ? { scaleY: [0.45, 1, 0.62, 0.88, 0.45] }
                    : { scaleY: 0.72 }
                }
                transition={{
                  duration: 0.8 + (index % 5) * 0.12,
                  repeat: isPlaying && !reduceMotion ? Infinity : 0,
                  ease: "easeInOut",
                  delay: (index % 6) * 0.04,
                }}
              />
            ))}
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <span className="text-ink truncate text-sm font-semibold">
              {isLoading
                ? "Loading MIDI…"
                : isPlaying
                  ? "Now playing"
                  : status === "paused"
                    ? "Paused"
                    : "MIDI arrangement"}
            </span>
            <span className="text-muted shrink-0 font-mono text-[10px] tracking-wider uppercase">
              {formatDuration(durationMs)}
            </span>
          </div>
        </div>
      </div>
      {message && (
        <p className="text-danger mt-3 text-sm" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}
