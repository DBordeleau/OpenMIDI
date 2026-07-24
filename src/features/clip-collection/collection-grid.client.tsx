"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiClock,
  FiGitBranch,
  FiLoader,
  FiPlay,
  FiRefreshCw,
} from "react-icons/fi";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal.client";
import { MIDI_V3_PPQ } from "@/features/midi/domain-v3";
import { MidiLibraryPreview } from "@/features/midi-library/midi-library-preview.client";
import { MidiLibraryReuseControls } from "@/features/midi-library/reuse-controls.client";
import type { OwnedPrivateMidiWorkspace } from "@/features/midi-library/types";
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

export function ClipCollectionGrid({
  items,
  selectedSource,
  workspaces,
}: {
  items: Item[];
  selectedSource: ClipCollectionSource;
  workspaces: OwnedPrivateMidiWorkspace[];
}) {
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
}: {
  item: Item;
  selectedSource: ClipCollectionSource;
  workspaces: OwnedPrivateMidiWorkspace[];
}) {
  const unavailable = studioClipAvailabilityMessage(item);
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

      <CollectionPreview item={item} unavailable={unavailable} />

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

function CollectionPreview({
  item,
  unavailable,
}: {
  item: Item;
  unavailable: string | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  const requestToken = useRef(0);
  const automaticAttempted = useRef(false);
  const requestInFlight = useRef(false);
  const [detail, setDetail] = useState<StudioClipDetail | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const loadDetail = useCallback(
    async (automatic = false) => {
      if (
        !item.canImport ||
        requestInFlight.current ||
        detail ||
        (automatic && automaticAttempted.current)
      ) {
        return;
      }
      if (automatic) automaticAttempted.current = true;
      requestInFlight.current = true;
      const token = ++requestToken.current;
      setStatus("loading");
      setMessage(null);
      const response = await getStudioClipDetailAction({
        patternVersionId: item.patternVersionId,
      });
      if (token !== requestToken.current) return;
      requestInFlight.current = false;
      if (!response.ok) {
        setStatus("error");
        setMessage(studioClipFailureMessage(response.code));
        return;
      }
      if (!response.detail.pattern || !response.detail.metadata.preset) {
        setStatus("error");
        setMessage(
          studioClipAvailabilityMessage(response.detail.metadata) ??
            "This exact clip is not available for preview.",
        );
        return;
      }
      setDetail(response.detail);
      setStatus("idle");
    },
    [detail, item.canImport, item.patternVersionId],
  );

  useEffect(() => {
    if (!item.canImport || detail) return;
    const target = container.current;
    if (!target || typeof IntersectionObserver === "undefined") {
      void loadDetail(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        void loadDetail(true);
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [detail, item.canImport, loadDetail]);

  useEffect(
    () => () => {
      requestToken.current += 1;
      requestInFlight.current = false;
    },
    [],
  );

  if (detail?.pattern && detail.metadata.preset) {
    return (
      <div ref={container} className="relative z-10">
        <MidiLibraryPreview
          listingId={item.savedListingId ?? item.patternVersionId}
          patternVersionId={item.patternVersionId}
          title={item.patternName}
          presetId={detail.metadata.preset.id}
          presetVersion={detail.metadata.preset.version}
          durationTicks={detail.pattern.durationTicks}
          notes={detail.pattern.notes}
        />
      </div>
    );
  }

  return (
    <div
      ref={container}
      className="border-subtle bg-surface-soft/60 rounded-card relative z-10 mt-4 border p-3"
    >
      <div className="flex min-h-11 items-center gap-3">
        <span
          aria-hidden
          className="border-strong text-accent-2 grid size-11 shrink-0 place-items-center rounded-full border"
        >
          {status === "loading" ? (
            <FiLoader className="animate-spin" />
          ) : status === "error" ? (
            <FiRefreshCw />
          ) : (
            <FiPlay className="ml-0.5 opacity-45" />
          )}
        </span>
        <p className="text-muted text-xs leading-5">
          {unavailable ??
            (status === "error"
              ? message
              : "Loading the exact MIDI notes for preview…")}
        </p>
      </div>
      {status === "error" && item.canImport && (
        <button
          type="button"
          onClick={() => void loadDetail()}
          className="text-accent hover:text-accent-2 mt-2 text-sm font-semibold"
        >
          Retry preview
        </button>
      )}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-subtle inline-flex min-h-6 items-center gap-1 rounded-full border px-2.5 py-1">
      {children}
    </span>
  );
}
