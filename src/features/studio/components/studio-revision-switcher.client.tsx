"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useStudioNavigation } from "./studio-shell.client";

const EMPTY_SUBSCRIBE = () => () => {};

/** Reads the top-bar portal slot without a setState-in-effect. */
function useSourceSlot() {
  return useSyncExternalStore(
    EMPTY_SUBSCRIBE,
    () => document.getElementById("studio-source-slot"),
    () => null,
  );
}

/**
 * The draft/revision source toggle. Instead of a full-width banner above the
 * Studio (which stole vertical space from the piano roll), it portals a compact
 * control into the Studio top bar's `#studio-source-slot`, beside Save. The
 * stale-draft warning becomes a small dot + tooltip rather than a paragraph.
 */
export function StudioRevisionSwitcher({
  projectId,
  revisionId,
  revisionNumber,
  selected,
  staleDraft,
}: {
  projectId: string;
  revisionId: string;
  revisionNumber: number;
  selected: "draft" | "revision";
  staleDraft: boolean;
}) {
  const { requestNavigation, switching } = useStudioNavigation();
  const slot = useSourceSlot();
  const draftUrl = `/studio/${projectId}`;
  const revisionUrl = `${draftUrl}?revision=${revisionId}`;

  function navigate(target: string) {
    if (requestNavigation) requestNavigation(target);
    else window.location.assign(target);
  }

  const detail =
    selected === "revision"
      ? "This read-only view includes the accepted arrangement. Your editable draft is preserved."
      : staleDraft
        ? `The latest revision ${revisionNumber} includes accepted changes. Switch views without replacing your private draft.`
        : "Switch to the published revision without changing this private draft.";

  const control = (
    <div
      className="ml-1 flex items-center gap-2"
      aria-label="Studio project source"
      title={detail}
    >
      {staleDraft && (
        <span
          className="bg-accent inline-block h-2 w-2 shrink-0 rounded-full"
          aria-label={`Your draft predates revision ${revisionNumber}`}
          role="img"
        />
      )}
      <div
        className="border-strong flex rounded-full border p-0.5"
        role="group"
        aria-label="Choose Studio source"
      >
        <button
          type="button"
          aria-pressed={selected === "draft"}
          disabled={switching || selected === "draft"}
          onClick={() => navigate(draftUrl)}
          className="aria-pressed:bg-surface-raised aria-pressed:text-ink text-muted min-h-7 rounded-full px-2.5 text-[11px] font-semibold transition-colors disabled:cursor-default"
        >
          Editable draft
        </button>
        <button
          type="button"
          aria-pressed={selected === "revision"}
          disabled={switching || selected === "revision"}
          onClick={() => navigate(revisionUrl)}
          className="aria-pressed:bg-surface-raised aria-pressed:text-ink text-muted min-h-7 rounded-full px-2.5 text-[11px] font-semibold transition-colors disabled:cursor-default"
        >
          Revision {revisionNumber}
        </button>
      </div>
    </div>
  );

  // Before the slot is found (first paint / SSR) render inline so the control
  // is never lost; once mounted it hops into the top bar.
  return slot ? createPortal(control, slot) : control;
}
