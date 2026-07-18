"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  FiBookmark,
  FiDownload,
  FiEdit3,
  FiGitBranch,
  FiPlus,
} from "react-icons/fi";
import { sanitizeFilenamePart } from "@/features/exports/filename";
import { exportMidiLibraryPattern } from "./library-export.client";
import {
  getMidiLibraryExportAction,
  removeSavedMidiLibraryPatternAction,
  reuseMidiLibraryPatternAction,
  saveMidiLibraryPatternAction,
} from "./reuse-actions";
import type { OwnedPrivateMidiWorkspace } from "./types";

export function MidiLibraryReuseControls({
  listingId,
  patternVersionId,
  title,
  saved,
  canReuse,
  workspaces,
  compact = false,
}: {
  listingId: string;
  patternVersionId: string;
  title: string;
  saved: boolean;
  canReuse: boolean;
  workspaces: OwnedPrivateMidiWorkspace[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [isSaved, setIsSaved] = useState(saved);
  const [workspaceId, setWorkspaceId] = useState(
    workspaces[0]?.workspaceId ?? "",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const workspace = workspaces.find((item) => item.workspaceId === workspaceId);
  const button =
    "border-strong hover:border-accent hover:text-accent inline-flex min-h-10 items-center justify-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors disabled:opacity-40";

  function run(
    task: () => Promise<{ ok: boolean; message: string; href?: string }>,
    after?: () => void,
  ) {
    startTransition(
      () =>
        void task().then((result) => {
          setMessage(result.message);
          if (result.ok) {
            after?.();
            if (result.href) router.push(result.href);
            else router.refresh();
          }
        }),
    );
  }

  async function downloadMidi() {
    setMessage("Preparing the exact MIDI version in your browser…");
    const result = await getMidiLibraryExportAction({
      listingId,
      patternVersionId,
    });
    if (!result.ok) {
      setMessage("This source is not currently eligible for library export.");
      return;
    }
    const bytes = exportMidiLibraryPattern(result.data);
    const blob = new Blob([bytes.slice().buffer as ArrayBuffer], {
      type: "audio/midi",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizeFilenamePart(title, "openmidi-pattern")}.mid`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setMessage(
      "MIDI exported locally with source and CC BY attribution metadata.",
    );
  }

  if (!canReuse)
    return (
      <p className="border-subtle text-muted mt-4 border-t pt-4 text-sm">
        This saved reference remains in your collection, but its source is not
        currently available for new reuse.
      </p>
    );

  return (
    <div
      className={`${compact ? "mt-4" : "rounded-card border-subtle bg-surface mt-6 border p-5"}`}
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={button}
          disabled={pending}
          onClick={() =>
            run(
              () =>
                isSaved
                  ? removeSavedMidiLibraryPatternAction({
                      listingId,
                      patternVersionId,
                      requestId: crypto.randomUUID(),
                    })
                  : saveMidiLibraryPatternAction({
                      listingId,
                      patternVersionId,
                      requestId: crypto.randomUUID(),
                    }),
              () => setIsSaved((value) => !value),
            )
          }
        >
          <FiBookmark aria-hidden />{" "}
          {isSaved ? "Remove saved clip" : "Save clip"}
        </button>
        <button
          type="button"
          className={button}
          disabled={pending}
          onClick={() => void downloadMidi()}
        >
          <FiDownload aria-hidden /> Export .mid
        </button>
        <button
          type="button"
          className={button}
          disabled={pending}
          onClick={() =>
            run(() =>
              reuseMidiLibraryPatternAction({
                listingId,
                patternVersionId,
                requestId: crypto.randomUUID(),
                operation: "fork",
                workspaceId: null,
                expectedWorkspaceLockVersion: null,
                copyName: `${title} — remix`,
                startTick: 0,
              }),
            )
          }
        >
          <FiGitBranch aria-hidden /> Create private fork
        </button>
      </div>
      {workspaces.length ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-56 flex-1 text-sm font-semibold">
            Owned private workspace
            <select
              className="rounded-control border-strong bg-canvas mt-1 min-h-10 w-full border px-3"
              value={workspaceId}
              onChange={(event) => setWorkspaceId(event.target.value)}
            >
              {workspaces.map((item) => (
                <option key={item.workspaceId} value={item.workspaceId}>
                  {item.projectTitle}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={button}
            disabled={pending || !workspace}
            onClick={() =>
              workspace &&
              run(() =>
                reuseMidiLibraryPatternAction({
                  listingId,
                  patternVersionId,
                  requestId: crypto.randomUUID(),
                  operation: "import",
                  workspaceId: workspace.workspaceId,
                  expectedWorkspaceLockVersion: workspace.lockVersion,
                  copyName: null,
                  startTick: 0,
                }),
              )
            }
          >
            <FiPlus aria-hidden /> Import exact version
          </button>
          <button
            type="button"
            className={button}
            disabled={pending || !workspace}
            onClick={() =>
              workspace &&
              run(() =>
                reuseMidiLibraryPatternAction({
                  listingId,
                  patternVersionId,
                  requestId: crypto.randomUUID(),
                  operation: "open_editor",
                  workspaceId: workspace.workspaceId,
                  expectedWorkspaceLockVersion: workspace.lockVersion,
                  copyName: `${title} — editable copy`,
                  startTick: 0,
                }),
              )
            }
          >
            <FiEdit3 aria-hidden /> Open in MIDI editor
          </button>
        </div>
      ) : (
        <p className="text-muted mt-3 text-sm">
          Create an owned private project workspace to import or open an
          editable copy.
        </p>
      )}
      {message && (
        <p className="text-muted mt-3 text-sm" role="status" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}
