"use client";

import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { FiAlertTriangle, FiX } from "react-icons/fi";
import type { StaleOwnerDraft } from "./studio-launcher.client";
import { StudioTopBarPortal } from "./studio-top-bar-portal.client";
import {
  resolveStaleOwnerDraftAction,
  type ResolveStaleDraftResult,
} from "@/features/workspaces/actions";
import { staleDraftForkTitleSchema } from "@/features/workspaces/schema";
import {
  clearMidiLocalRecovery,
  writeStudioResolutionAnnouncement,
} from "@/features/workspaces/midi-local-recovery.client";

type Resolution = "restart_latest" | "preserve_as_fork";
type Step = "choice" | "restart" | "fork";

export function StaleDraftResolution({
  projectId,
  projectTitle,
  viewerId,
  workspaceId,
  staleDraft,
  prepareResolution,
  onResolved,
  onAuthorityConflict,
  onFailure,
  onDecisionOpenChange,
  resolveAction = resolveStaleOwnerDraftAction,
}: {
  projectId: string;
  projectTitle: string;
  viewerId: string;
  workspaceId: string;
  staleDraft: StaleOwnerDraft;
  prepareResolution(): Promise<number | null>;
  onResolved(
    result: Extract<ResolveStaleDraftResult, { ok: true }>,
    forkTitle: string | null,
  ): void;
  onAuthorityConflict(): void;
  onFailure(message: string): void;
  onDecisionOpenChange(open: boolean): void;
  resolveAction?: typeof resolveStaleOwnerDraftAction;
}) {
  const router = useRouter();
  const suffix = " - recovered draft";
  const defaultTitle = `${projectTitle
    .slice(0, 120 - suffix.length)
    .trimEnd()}${suffix}`;
  const [step, setStep] = useState<Step | null>(null);
  const [forkTitle, setForkTitle] = useState(defaultTitle);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intent = useRef<{ key: string; requestId: string } | null>(null);

  function open() {
    setStep("choice");
    setError(null);
    onDecisionOpenChange(true);
  }

  function close() {
    if (pending) return;
    setStep(null);
    setError(null);
    onDecisionOpenChange(false);
  }

  async function resolve(resolution: Resolution) {
    const normalizedTitle =
      resolution === "preserve_as_fork"
        ? staleDraftForkTitleSchema.safeParse(forkTitle)
        : null;
    if (normalizedTitle && !normalizedTitle.success) {
      setError("Enter a fork title between 1 and 120 characters.");
      return;
    }

    setPending(true);
    setError(null);
    const acknowledgedLockVersion = await prepareResolution();
    if (!acknowledgedLockVersion) {
      setPending(false);
      setError(
        "Finish saving this draft before moving it. Your local recovery copy is still here.",
      );
      return;
    }

    const title =
      normalizedTitle && normalizedTitle.success ? normalizedTitle.data : null;
    const intentKey = `${resolution}:${title ?? ""}`;
    if (intent.current?.key !== intentKey) {
      intent.current = { key: intentKey, requestId: crypto.randomUUID() };
    }

    let result: ResolveStaleDraftResult;
    try {
      result = await resolveAction({
        workspaceId,
        requestId: intent.current.requestId,
        expectedWorkspaceLockVersion: acknowledgedLockVersion,
        expectedBaseRevisionId: staleDraft.baseRevisionId,
        expectedCurrentRevisionId: staleDraft.currentRevisionId,
        resolution,
        forkTitle: title,
      });
    } catch {
      result = { ok: false, code: "unavailable" };
    }

    if (result.ok) {
      setStep(null);
      setPending(false);
      onDecisionOpenChange(false);
      clearMidiLocalRecovery(viewerId, workspaceId);
      writeStudioResolutionAnnouncement(
        result.targetProjectId,
        result.resolution === "preserve_as_fork"
          ? `Private fork "${title ?? projectTitle}" is ready with your recovered draft.`
          : `A fresh draft now starts from revision ${staleDraft.currentRevisionNumber}.`,
      );
      onResolved(result, title);
      router.push(`/studio/${result.targetProjectId}`);
      router.refresh();
      return;
    }

    setPending(false);
    if (
      result.code === "workspace_changed" ||
      result.code === "project_changed" ||
      result.code === "not_stale"
    ) {
      setError(
        "Studio authority changed. Reloading the current draft safely...",
      );
      onDecisionOpenChange(false);
      setStep(null);
      onAuthorityConflict();
      return;
    }
    const failureMessage =
      result.code === "forbidden"
        ? "This stale draft is no longer eligible for owner recovery."
        : result.code === "invalid_request"
          ? "This recovery request changed. Review the choice and try again."
          : "The draft could not be moved. Your saved and local recovery copies are unchanged.";
    setError(failureMessage);
    setStep(null);
    onDecisionOpenChange(false);
    onFailure(failureMessage);
  }

  return (
    <>
      <StudioTopBarPortal>
        <button
          type="button"
          onClick={open}
          aria-haspopup="dialog"
          className="border-accent text-ink hover:bg-surface-raised ml-1 inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors"
        >
          <FiAlertTriangle aria-hidden className="text-accent shrink-0" />
          Draft based on revision {staleDraft.baseRevisionNumber}
          <span aria-hidden>-</span>
          <span className="text-accent">Resolve</span>
        </button>
      </StudioTopBarPortal>

      {step && (
        <ResolutionDialog
          title={
            step === "choice"
              ? "Resolve this older draft"
              : step === "restart"
                ? `Continue from revision ${staleDraft.currentRevisionNumber}`
                : "Preserve this draft as a fork"
          }
          descriptionId={`${projectId}-stale-draft-description`}
          focusStep={step}
          pending={pending}
          onClose={close}
        >
          {step === "choice" ? (
            <>
              <p
                id={`${projectId}-stale-draft-description`}
                className="text-muted mt-3 leading-7"
              >
                Revision {staleDraft.currentRevisionNumber} was published while
                you were editing revision {staleDraft.baseRevisionNumber}. This
                draft cannot overwrite the newer project history.
              </p>
              <div className="mt-6 grid gap-3">
                <button
                  type="button"
                  data-autofocus
                  disabled={pending}
                  className="cta-gradient text-accent-contrast min-h-11 rounded-full px-4 font-semibold disabled:opacity-50"
                  onClick={() => setStep("restart")}
                >
                  Continue from revision {staleDraft.currentRevisionNumber}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="border-strong hover:border-accent min-h-11 rounded-full border px-4 font-semibold disabled:opacity-50"
                  onClick={() => setStep("fork")}
                >
                  Preserve draft as a fork
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="text-muted hover:text-ink min-h-11 rounded-full px-4 font-semibold disabled:opacity-50"
                  onClick={close}
                >
                  Keep editing for now
                </button>
              </div>
            </>
          ) : step === "restart" ? (
            <>
              <p
                id={`${projectId}-stale-draft-description`}
                className="text-muted mt-3 leading-7"
              >
                Start a fresh draft from revision{" "}
                {staleDraft.currentRevisionNumber}? Your current draft will not
                be carried over. Choose Preserve as a fork if you want to keep
                working from revision {staleDraft.baseRevisionNumber}.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  data-autofocus
                  disabled={pending}
                  className="cta-gradient text-accent-contrast min-h-11 rounded-full px-4 font-semibold disabled:opacity-50"
                  onClick={() => void resolve("restart_latest")}
                >
                  {pending
                    ? "Starting fresh draft..."
                    : `Start from revision ${staleDraft.currentRevisionNumber}`}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="border-strong hover:border-accent min-h-11 rounded-full border px-4 font-semibold disabled:opacity-50"
                  onClick={() => setStep("fork")}
                >
                  Preserve as a fork instead
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="text-muted hover:text-ink min-h-11 rounded-full px-4 font-semibold disabled:opacity-50"
                  onClick={() => setStep("choice")}
                >
                  Back
                </button>
              </div>
            </>
          ) : (
            <>
              <p
                id={`${projectId}-stale-draft-description`}
                className="text-muted mt-3 leading-7"
              >
                The new private fork will start at revision{" "}
                {staleDraft.baseRevisionNumber} and keep this saved draft as its
                editable workspace. Nothing will be published until you publish
                it.
              </p>
              <label className="mt-5 block text-sm font-semibold">
                Private fork title
                <input
                  data-autofocus
                  className="border-strong bg-canvas rounded-control mt-2 min-h-11 w-full border px-3"
                  value={forkTitle}
                  maxLength={120}
                  required
                  disabled={pending}
                  onChange={(event) => {
                    setForkTitle(event.target.value);
                    setError(null);
                  }}
                />
              </label>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={pending}
                  className="cta-gradient text-accent-contrast min-h-11 rounded-full px-4 font-semibold disabled:opacity-50"
                  onClick={() => void resolve("preserve_as_fork")}
                >
                  {pending ? "Creating private fork..." : "Create private fork"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="text-muted hover:text-ink min-h-11 rounded-full px-4 font-semibold disabled:opacity-50"
                  onClick={() => setStep("choice")}
                >
                  Back
                </button>
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="text-danger mt-4">
              {error}
            </p>
          )}
        </ResolutionDialog>
      )}
    </>
  );
}

function ResolutionDialog({
  title,
  descriptionId,
  focusStep,
  pending,
  onClose,
  children,
}: {
  title: string;
  descriptionId: string;
  focusStep: Step;
  pending: boolean;
  onClose(): void;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    return () => returnFocus.current?.focus();
  }, []);

  useEffect(() => {
    const initial =
      dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]") ??
      dialogRef.current;
    initial?.focus();
  }, [focusStep]);

  function containFocus(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && !pending) {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [
      ...(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? []),
    ];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] grid overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-8"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <motion.section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={pending}
        onKeyDown={containFocus}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduce ? 0 : 0.18 }}
        className="rounded-card border-strong bg-canvas m-auto max-h-[calc(100vh-1.5rem)] w-full max-w-xl overflow-y-auto border p-5 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-2xl font-semibold">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close draft resolution"
            disabled={pending}
            onClick={onClose}
            className="border-strong hover:border-accent grid h-11 w-11 shrink-0 place-items-center rounded-full border disabled:opacity-40"
          >
            <FiX aria-hidden />
          </button>
        </div>
        {children}
      </motion.section>
    </div>
  );
}
