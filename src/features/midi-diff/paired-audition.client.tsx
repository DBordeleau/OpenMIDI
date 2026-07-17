"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiLoader, FiPause, FiPlay } from "react-icons/fi";
import type { MidiPatternVersionV3 } from "@/features/midi/domain-v3";
import type { PublicMidiEvent } from "@/features/public-midi/schedule";
import {
  publicMidiDurationMs,
  schedulePublicMidiRevision,
} from "@/features/public-midi/schedule";
import type { ArrangementManifestV3 } from "@/features/studio/manifest/v3";

export type MidiDiffAuditionSide = {
  manifest: ArrangementManifestV3;
  patternVersions: readonly MidiPatternVersionV3[];
};

export type MidiDiffAuditionRuntime = {
  prepare(events: readonly PublicMidiEvent[]): Promise<void>;
  play(fromSeconds: number): Promise<void>;
  pause(): void;
  dispose(): void;
};

export type MidiDiffAuditionRuntimeFactory =
  () => Promise<MidiDiffAuditionRuntime>;

async function createRuntime(): Promise<MidiDiffAuditionRuntime> {
  const { PublicMidiPreviewRuntime } =
    await import("@/features/public-midi/preview-runtime.client");
  return new PublicMidiPreviewRuntime();
}

type AuditionSide = "before" | "after";
type AuditionStatus = "idle" | "loading" | "playing" | "error";

type MidiDiffPairedAuditionProps = {
  before: MidiDiffAuditionSide;
  after: MidiDiffAuditionSide;
  sideLabels: { before: string; after: string };
  selectionKey: string;
  runtimeFactory?: MidiDiffAuditionRuntimeFactory;
};

export function MidiDiffPairedAudition({
  selectionKey,
  ...props
}: MidiDiffPairedAuditionProps) {
  return <PairedAuditionSession key={selectionKey} {...props} />;
}

function PairedAuditionSession({
  before,
  after,
  sideLabels,
  runtimeFactory = createRuntime,
}: Omit<MidiDiffPairedAuditionProps, "selectionKey">) {
  const [status, setStatus] = useState<AuditionStatus>("idle");
  const [activeSide, setActiveSide] = useState<AuditionSide | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const runtimeRef = useRef<MidiDiffAuditionRuntime | null>(null);
  const requestRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disposeCurrent = useCallback(() => {
    requestRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    runtimeRef.current?.pause();
    runtimeRef.current?.dispose();
    runtimeRef.current = null;
  }, []);

  const stop = useCallback(() => {
    disposeCurrent();
    setActiveSide(null);
    setStatus("idle");
    setMessage(null);
  }, [disposeCurrent]);

  useEffect(() => () => disposeCurrent(), [disposeCurrent]);

  async function play(side: AuditionSide) {
    if (activeSide === side && status === "playing") {
      stop();
      return;
    }
    disposeCurrent();
    const request = requestRef.current;
    setActiveSide(side);
    setStatus("loading");
    setMessage(null);
    const source = side === "before" ? before : after;
    let runtime: MidiDiffAuditionRuntime | null = null;
    try {
      const patterns = new Map(
        source.patternVersions.map((pattern) => [
          pattern.midiPatternVersionId,
          pattern,
        ]),
      );
      const events = schedulePublicMidiRevision(source.manifest, patterns);
      runtime = await runtimeFactory();
      await runtime.prepare(events);
      if (request !== requestRef.current) {
        runtime.dispose();
        return;
      }
      runtimeRef.current = runtime;
      await runtime.play(0);
      if (request !== requestRef.current) {
        runtime.dispose();
        if (runtimeRef.current === runtime) runtimeRef.current = null;
        return;
      }
      setStatus("playing");
      const durationMs = publicMidiDurationMs(source.manifest);
      timerRef.current = setTimeout(() => {
        runtime?.dispose();
        if (runtimeRef.current === runtime) runtimeRef.current = null;
        setActiveSide(null);
        setStatus("idle");
      }, durationMs + 80);
    } catch {
      runtime?.dispose();
      if (request !== requestRef.current) return;
      setActiveSide(null);
      setStatus("error");
      setMessage("This exact MIDI side could not be played. Try again.");
    }
  }

  return (
    <section
      aria-labelledby="paired-audition-heading"
      className="border-subtle bg-surface rounded-card mt-5 border p-5 sm:p-6"
    >
      <h3 id="paired-audition-heading" className="text-xl font-bold">
        Audition exact sides
      </h3>
      <p className="text-muted mt-2 text-sm">
        Read-only browser synthesis. Starting either immutable side stops and
        disposes the other.
      </p>
      <div
        className="mt-4 flex flex-wrap gap-3"
        role="group"
        aria-label="Immutable arrangement audition"
      >
        {(["before", "after"] as const).map((side) => {
          const label = sideLabels[side];
          const isActive = activeSide === side;
          const isLoading = isActive && status === "loading";
          const isPlaying = isActive && status === "playing";
          return (
            <button
              aria-pressed={isPlaying}
              className={`border-strong hover:border-accent focus:border-accent inline-flex min-h-11 items-center gap-2 rounded-full border px-5 font-semibold ${isPlaying ? "border-accent text-accent" : ""}`}
              disabled={status === "loading"}
              key={side}
              onClick={() => void play(side)}
              type="button"
            >
              {isLoading ? (
                <FiLoader className="animate-spin" aria-hidden="true" />
              ) : isPlaying ? (
                <FiPause aria-hidden="true" />
              ) : (
                <FiPlay aria-hidden="true" />
              )}
              {isPlaying ? `Stop ${label}` : `Play ${label}`}
            </button>
          );
        })}
      </div>
      <p className="text-muted mt-3 text-sm" aria-live="polite" role="status">
        {status === "loading" && activeSide
          ? `Preparing ${sideLabels[activeSide]}`
          : status === "playing" && activeSide
            ? `Now playing ${sideLabels[activeSide]}. The other side is stopped.`
            : "No comparison side is playing."}
      </p>
      {message && (
        <p className="text-danger mt-2 text-sm" role="alert">
          {message}
        </p>
      )}
    </section>
  );
}
