"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  FiClock,
  FiGitBranch,
  FiLoader,
  FiPause,
  FiPlay,
  FiRefreshCw,
} from "react-icons/fi";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal.client";
import { MIDI_V3_PPQ } from "@/features/midi/domain-v3";
import { MidiLibraryReuseControls } from "@/features/midi-library/reuse-controls.client";
import type { OwnedPrivateMidiWorkspace } from "@/features/midi-library/types";
import { PatternRoll } from "@/features/midi-library/pattern-roll";
import { PublicMidiPreviewRuntime } from "@/features/public-midi/preview-runtime.client";
import type { PublicMidiEvent } from "@/features/public-midi/schedule";
import { getStudioClipDetailAction } from "@/features/studio/clip-collection/actions";
import {
  studioClipAvailabilityMessage,
  studioClipFailureMessage,
} from "@/features/studio/clip-collection/presentation";
import type {
  StudioClipCollection,
  StudioClipDetail,
} from "@/features/studio/clip-collection/schema";
import type { ClipCollectionSource } from "./search";

type Item = StudioClipCollection["items"][number];
type PreviewState = {
  id: string | null;
  status: "idle" | "loading" | "playing" | "paused" | "error";
  message: string | null;
  detail: StudioClipDetail | null;
};

const IDLE_PREVIEW: PreviewState = {
  id: null,
  status: "idle",
  message: null,
  detail: null,
};

export function ClipCollectionGrid({
  items,
  selectedSource,
  workspaces,
}: {
  items: Item[];
  selectedSource: ClipCollectionSource;
  workspaces: OwnedPrivateMidiWorkspace[];
}) {
  const instanceId = useId();
  const requestToken = useRef(0);
  const runtime = useRef<PublicMidiPreviewRuntime | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detailCache = useRef(new Map<string, StudioClipDetail>());
  const collectionKey = `${selectedSource}:${items
    .map((item) => item.patternVersionId)
    .join(",")}`;
  const previousCollectionKey = useRef(collectionKey);
  const [preview, setPreview] = useState<PreviewState>(IDLE_PREVIEW);

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const stopPreview = useCallback(
    (next: PreviewState = IDLE_PREVIEW) => {
      requestToken.current += 1;
      clearTimer();
      runtime.current?.pause();
      setPreview(next);
    },
    [clearTimer],
  );

  useEffect(() => {
    if (previousCollectionKey.current === collectionKey) return;
    previousCollectionKey.current = collectionKey;
    stopPreview();
  }, [collectionKey, stopPreview]);

  useEffect(() => {
    const stopForOtherPlayer = (event: Event) => {
      const detail = (event as CustomEvent<{ instanceId?: string }>).detail;
      if (detail?.instanceId !== instanceId) stopPreview();
    };
    window.addEventListener(
      "openmidi:public-midi-preview-play",
      stopForOtherPlayer,
    );
    return () =>
      window.removeEventListener(
        "openmidi:public-midi-preview-play",
        stopForOtherPlayer,
      );
  }, [instanceId, stopPreview]);

  useEffect(
    () => () => {
      requestToken.current += 1;
      clearTimer();
      runtime.current?.dispose();
    },
    [clearTimer],
  );

  async function togglePreview(item: Item) {
    if (!item.canImport) return;
    if (preview.id === item.patternVersionId && preview.status === "playing") {
      stopPreview({
        ...preview,
        status: "paused",
        message: null,
      });
      return;
    }

    stopPreview();
    const token = ++requestToken.current;
    setPreview({
      id: item.patternVersionId,
      status: "loading",
      message: null,
      detail: null,
    });

    let detail = detailCache.current.get(item.patternVersionId);
    if (!detail) {
      const response = await getStudioClipDetailAction({
        patternVersionId: item.patternVersionId,
      });
      if (token !== requestToken.current) return;
      if (!response.ok) {
        setPreview({
          id: item.patternVersionId,
          status: "error",
          message: studioClipFailureMessage(response.code),
          detail: null,
        });
        return;
      }
      detail = response.detail;
      detailCache.current.set(item.patternVersionId, detail);
    }

    if (token !== requestToken.current) return;
    if (!detail.pattern || !detail.metadata.preset) {
      setPreview({
        id: item.patternVersionId,
        status: "error",
        message:
          studioClipAvailabilityMessage(detail.metadata) ??
          "This exact clip is not available for preview.",
        detail,
      });
      return;
    }

    const AudioContextConstructor =
      window.AudioContext ??
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;
    if (!AudioContextConstructor) {
      setPreview({
        id: item.patternVersionId,
        status: "error",
        message: "This browser cannot run the local MIDI preview.",
        detail,
      });
      return;
    }

    let nextRuntime: PublicMidiPreviewRuntime | null = null;
    try {
      nextRuntime = new PublicMidiPreviewRuntime();
      await nextRuntime.prepare(toPreviewEvents(detail));
      if (token !== requestToken.current) {
        nextRuntime.dispose();
        return;
      }
      runtime.current?.dispose();
      runtime.current = nextRuntime;
      window.dispatchEvent(
        new CustomEvent("openmidi:preview-play", {
          detail: { instanceId },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("openmidi:public-midi-preview-play", {
          detail: { instanceId },
        }),
      );
      await nextRuntime.play(0);
      if (token !== requestToken.current) {
        nextRuntime.dispose();
        if (runtime.current === nextRuntime) runtime.current = null;
        return;
      }
      const durationMs = Math.ceil(
        (detail.pattern.durationTicks * 60_000) / (120 * MIDI_V3_PPQ),
      );
      const activeRuntime = nextRuntime;
      timer.current = setTimeout(() => {
        activeRuntime.pause();
        setPreview(IDLE_PREVIEW);
      }, durationMs + 80);
      setPreview({
        id: item.patternVersionId,
        status: "playing",
        message: null,
        detail,
      });
    } catch {
      nextRuntime?.dispose();
      if (runtime.current === nextRuntime) runtime.current = null;
      if (token !== requestToken.current) return;
      setPreview({
        id: item.patternVersionId,
        status: "error",
        message: "The browser-local MIDI preview could not start. Try again.",
        detail,
      });
    }
  }

  return (
    <ul className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item, index) => (
        <Reveal
          as="li"
          key={item.patternVersionId}
          delay={0.08 + Math.min(index, 8) * 0.05}
          className="flex min-w-0"
        >
          <CollectionCard
            item={item}
            selectedSource={selectedSource}
            workspaces={workspaces}
            preview={preview}
            onPreview={() => void togglePreview(item)}
          />
        </Reveal>
      ))}
    </ul>
  );
}

function CollectionCard({
  item,
  selectedSource,
  workspaces,
  preview,
  onPreview,
}: {
  item: Item;
  selectedSource: ClipCollectionSource;
  workspaces: OwnedPrivateMidiWorkspace[];
  preview: PreviewState;
  onPreview: () => void;
}) {
  const unavailable = studioClipAvailabilityMessage(item);
  const active = preview.id === item.patternVersionId;
  const playing = active && preview.status === "playing";
  const loading = active && preview.status === "loading";
  const error = active && preview.status === "error";
  const notes = active ? preview.detail?.pattern?.notes : undefined;
  const beats = item.durationTicks / MIDI_V3_PPQ;
  const savedCanReuse = item.savedCanImport ?? false;
  const versionCount = item.versionCount;

  return (
    <article
      data-collection-pattern={item.patternId}
      data-collection-version={item.patternVersionId}
      className="dash-card dash-card-action rounded-card relative flex w-full min-w-0 flex-col overflow-hidden p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="border-accent/35 text-accent rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase">
          {selectedSource === "owned" ? "My clip" : "Exact bookmark"}
        </span>
        {selectedSource === "saved" && (
          <span className="border-accent-2/45 bg-accent-2/10 text-accent-2 rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase">
            CC BY 4.0
          </span>
        )}
        <span className="text-muted ml-auto font-mono text-[10px] tracking-wide uppercase">
          v{item.versionNumber}
        </span>
      </div>

      <h2 className="mt-3 text-xl font-bold tracking-[-0.02em] text-balance break-words">
        {selectedSource === "saved" && item.savedListingId ? (
          <Link
            href={`/library/${item.savedListingId}`}
            prefetch={false}
            className="hover:text-accent transition-colors after:absolute after:inset-0 after:rounded-[inherit]"
          >
            {item.patternName}
          </Link>
        ) : (
          item.patternName
        )}
      </h2>
      <p className="text-muted mt-1 text-sm break-words">
        {selectedSource === "owned"
          ? "Latest version by "
          : "Saved version by "}
        {item.creatorCreditName}
      </p>

      <div className="border-subtle bg-surface-soft/60 rounded-card relative z-10 mt-4 border p-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPreview}
            disabled={!item.canImport || loading}
            aria-label={
              playing
                ? `Pause ${item.patternName}`
                : `${error ? "Retry preview" : "Preview"} ${item.patternName}`
            }
            title={unavailable ?? "Browser-local MIDI preview"}
            className={`grid size-11 shrink-0 place-items-center rounded-full border text-lg ${
              playing
                ? "cta-gradient border-transparent"
                : "border-strong text-accent-2 hover:border-accent"
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {loading ? (
              <FiLoader aria-hidden className="animate-spin" />
            ) : playing ? (
              <FiPause aria-hidden />
            ) : error ? (
              <FiRefreshCw aria-hidden />
            ) : (
              <FiPlay aria-hidden className="ml-0.5" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            {notes && preview.detail?.pattern ? (
              <PatternRoll
                notes={notes}
                durationTicks={preview.detail.pattern.durationTicks}
                className="h-9"
              />
            ) : (
              <p className="text-muted flex h-9 items-center text-xs">
                Exact notes stay private until you ask to hear them.
              </p>
            )}
            <p className="text-muted mt-1.5 text-xs">
              {loading
                ? "Loading exact MIDI detail…"
                : playing
                  ? "Now playing · 120 BPM"
                  : preview.status === "paused" && active
                    ? "Paused"
                    : "Detail loads only when you preview"}
            </p>
          </div>
        </div>
        {error && preview.message && (
          <p role="alert" className="text-danger mt-2 text-sm">
            {preview.message}
          </p>
        )}
      </div>

      <div className="text-muted mt-3 flex flex-wrap gap-1.5 font-mono text-[10px]">
        <Chip>
          <FiClock aria-hidden />{" "}
          {Number.isInteger(beats) ? beats : beats.toFixed(1)} beats
        </Chip>
        <Chip>{item.noteCount} notes</Chip>
        {item.preset && <Chip>{item.preset.name}</Chip>}
        {selectedSource === "owned" && versionCount && (
          <Chip>
            {versionCount} version{versionCount === 1 ? "" : "s"}
          </Chip>
        )}
        {item.hasLineage && (
          <Chip>
            <FiGitBranch aria-hidden /> Lineage
          </Chip>
        )}
      </div>

      {unavailable && (
        <p className="text-accent-2 mt-3 text-sm leading-5">{unavailable}</p>
      )}

      <div className="relative z-10 mt-auto pt-4">
        {selectedSource === "owned" ? (
          <ButtonLink href="/studio" prefetch={false}>
            Use in Studio
          </ButtonLink>
        ) : item.savedListingId ? (
          <MidiLibraryReuseControls
            listingId={item.savedListingId}
            patternVersionId={item.patternVersionId}
            title={item.patternName}
            saved
            canReuse={savedCanReuse}
            workspaces={workspaces}
            compact
          />
        ) : null}
      </div>
    </article>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-subtle inline-flex min-h-6 items-center gap-1 rounded-full border px-2.5 py-1">
      {children}
    </span>
  );
}

function toPreviewEvents(detail: StudioClipDetail): PublicMidiEvent[] {
  const pattern = detail.pattern;
  const preset = detail.metadata.preset;
  if (!pattern || !preset) return [];
  return pattern.notes.map((note) => ({
    eventId: `${pattern.midiPatternVersionId}:${note.noteId}`,
    trackId: pattern.midiPatternId,
    clipId: pattern.midiPatternVersionId,
    midiPatternVersionId: pattern.midiPatternVersionId,
    presetId: preset.id,
    presetVersion: preset.version,
    pitch: note.pitch,
    velocity: note.velocity,
    startTick: note.startTick,
    endTick: note.startTick + note.durationTicks,
    startSeconds: note.startTick / 960,
    durationSeconds: note.durationTicks / 960,
    gainDb: -6,
    pan: 0,
  }));
}
