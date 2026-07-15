"use client";

import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { FiLoader, FiPause, FiPlay } from "react-icons/fi";
import {
  quickPreviewResponseSchema,
  type QuickPreviewResponse,
} from "../preview-contract";
import { buildPreviewSchedule } from "./preview-schedule";
import { projectMidiSchedule } from "@/features/midi/scheduler";
import { BrowserMidiRuntime } from "../midi-adapter/browser-midi-runtime.client";

const PREVIEW_PLAY_EVENT = "jam-session:preview-play";
const BAR_HEIGHTS = [
  36, 58, 82, 48, 72, 94, 62, 42, 76, 54, 88, 66, 44, 80, 60, 92, 52, 70,
];
type PreviewStatus = "idle" | "loading" | "playing" | "paused" | "error";

export function QuickPreviewPlayer({
  projectId,
  revisionId,
  title,
  durationMs,
  compact = false,
}: {
  projectId: string;
  revisionId: string;
  title: string;
  durationMs: number;
  compact?: boolean;
}) {
  const instanceId = useId();
  const reduceMotion = useReducedMotion();
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const dataRef = useRef<QuickPreviewResponse | null>(null);
  const buffersRef = useRef<AudioBuffer[] | null>(null);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const playheadMs = useRef(0);
  const playheadAtStartMs = useRef(0);
  const startedAt = useRef(0);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const midiRuntime = useRef<BrowserMidiRuntime | null>(null);
  const loaded = useRef(false);

  const stopScheduled = useCallback(() => {
    if (endTimer.current) clearTimeout(endTimer.current);
    endTimer.current = null;
    for (const source of sourcesRef.current) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // A source that has already ended needs no further cleanup.
      }
      source.disconnect();
    }
    sourcesRef.current = [];
  }, []);

  const pause = useCallback(() => {
    request.current?.abort();
    request.current = null;
    const context = contextRef.current;
    if (context && startedAt.current > 0) {
      playheadMs.current = Math.min(
        durationMs,
        playheadAtStartMs.current +
          Math.max(0, context.currentTime - startedAt.current) * 1_000,
      );
    } else if (startedAt.current > 0) {
      playheadMs.current = Math.min(
        durationMs,
        playheadAtStartMs.current +
          Math.max(0, performance.now() / 1_000 - startedAt.current) * 1_000,
      );
    }
    startedAt.current = 0;
    midiRuntime.current?.pause();
    stopScheduled();
    setStatus((current) =>
      current === "playing"
        ? "paused"
        : current === "loading"
          ? "idle"
          : current,
    );
  }, [durationMs, stopScheduled]);

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
      stopScheduled();
      midiRuntime.current?.dispose();
      void contextRef.current?.close();
    },
    [stopScheduled],
  );

  const load = useCallback(async () => {
    if (loaded.current && dataRef.current)
      return { data: dataRef.current, buffers: buffersRef.current };
    const controller = new AbortController();
    request.current = controller;
    const response = await fetch(
      `/api/projects/${projectId}/revisions/${revisionId}/preview`,
      { method: "POST", cache: "no-store", signal: controller.signal },
    );
    if (!response.ok) throw new Error("Preview unavailable");
    const data = quickPreviewResponseSchema.parse(await response.json());
    if (data.projectId !== projectId || data.revisionId !== revisionId)
      throw new Error("Preview changed");
    if (data.kind === "midi") {
      const runtime = new BrowserMidiRuntime();
      const stems = new Map(
        data.stems.map((stem) => [stem.stemVersionId, stem]),
      );
      await runtime.prepare(
        projectMidiSchedule({ manifest: data.manifest, stemVersions: stems }),
      );
      await runtime.prepareAudio(data.manifest, data.audioSources);
      midiRuntime.current?.dispose();
      midiRuntime.current = runtime;
      dataRef.current = data;
      buffersRef.current = null;
      loaded.current = true;
      request.current = null;
      return { data, buffers: null };
    }
    const context = contextRef.current ?? new AudioContext();
    contextRef.current = context;
    const buffers = await Promise.all(
      data.tracks.map(async (track) => {
        const sourceResponse = await fetch(track.signedUrl, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!sourceResponse.ok) throw new Error("Audio unavailable");
        return context.decodeAudioData(await sourceResponse.arrayBuffer());
      }),
    );
    dataRef.current = data;
    buffersRef.current = buffers;
    loaded.current = true;
    request.current = null;
    return { data, buffers };
  }, [projectId, revisionId]);

  const play = async () => {
    window.dispatchEvent(
      new CustomEvent(PREVIEW_PLAY_EVENT, { detail: { instanceId } }),
    );
    setStatus("loading");
    setMessage(null);
    try {
      const { data, buffers } = await load();
      if (data.kind === "midi") {
        await midiRuntime.current!.play(playheadMs.current / 1_000);
        playheadAtStartMs.current = playheadMs.current;
        startedAt.current = performance.now() / 1_000;
        endTimer.current = setTimeout(
          () => {
            midiRuntime.current?.pause();
            playheadMs.current = 0;
            startedAt.current = 0;
            setStatus("idle");
          },
          data.durationMs - playheadMs.current + 80,
        );
        setStatus("playing");
        return;
      }
      const context = contextRef.current!;
      await context.resume();
      if (playheadMs.current >= data.durationMs) playheadMs.current = 0;
      const schedule = buildPreviewSchedule(data.tracks, playheadMs.current);
      const startTime = context.currentTime + 0.04;
      sourcesRef.current = schedule.map((item) => {
        const source = context.createBufferSource();
        const gain = context.createGain();
        const panner = context.createStereoPanner();
        source.buffer = buffers![item.trackIndex]!;
        gain.gain.value = item.gain;
        panner.pan.value = item.pan;
        source.connect(gain).connect(panner).connect(context.destination);
        source.start(
          startTime + item.delaySeconds,
          item.offsetSeconds,
          item.durationSeconds,
        );
        return source;
      });
      playheadAtStartMs.current = playheadMs.current;
      startedAt.current = startTime;
      endTimer.current = setTimeout(
        () => {
          stopScheduled();
          playheadMs.current = 0;
          startedAt.current = 0;
          setStatus("idle");
        },
        data.durationMs - playheadMs.current + 80,
      );
      setStatus("playing");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      stopScheduled();
      setStatus("error");
      setMessage("This preview couldn’t be loaded. Try again in a moment.");
    }
  };

  const isPlaying = status === "playing";
  const isLoading = status === "loading";
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
          aria-label={isPlaying ? `Pause ${title}` : `Play ${title}`}
          title={isPlaying ? "Pause preview" : "Play latest revision"}
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
                ? "Loading stems…"
                : isPlaying
                  ? "Now playing"
                  : status === "paused"
                    ? "Paused"
                    : "Latest revision"}
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
