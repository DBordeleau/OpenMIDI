"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  type FormEvent,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  FiAlertCircle,
  FiCheck,
  FiClock,
  FiFolderPlus,
  FiGitBranch,
  FiLoader,
  FiMusic,
  FiPause,
  FiPlay,
  FiRefreshCw,
  FiSearch,
  FiUser,
  FiX,
} from "react-icons/fi";
import {
  getStudioClipDetailAction,
  importStudioClipAction,
  listStudioClipCollectionAction,
  type StudioClipFailureCode,
} from "./actions";
import {
  formatStudioClipDuration,
  studioClipAvailabilityMessage,
  studioClipContext,
  studioClipFailureMessage,
} from "./presentation";
import type {
  ImportStudioClipResult,
  StudioClipCollection,
  StudioClipDetail,
} from "./schema";
import { PublicMidiPreviewRuntime } from "@/features/public-midi/preview-runtime.client";
import type { PublicMidiEvent } from "@/features/public-midi/schedule";

type StudioClipItem = StudioClipCollection["items"][number];
type Source = "owned" | "saved";
type ImportAuthority =
  | {
      ok: true;
      workspaceId: string;
      expectedWorkspaceLockVersion: number;
      startTick: number;
    }
  | { ok: false; message: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  prepareImport: () => Promise<ImportAuthority>;
  onImported: (result: ImportStudioClipResult) => void;
  onImportFailure: (code: StudioClipFailureCode) => void;
};

type PreviewState = {
  patternVersionId: string | null;
  status: "idle" | "loading" | "playing" | "paused" | "error";
  message: string | null;
};

const initialPreview: PreviewState = {
  patternVersionId: null,
  status: "idle",
  message: null,
};

export function StudioClipDrawer({
  open,
  onOpenChange,
  triggerRef,
  prepareImport,
  onImported,
  onImportFailure,
}: Props) {
  const reduce = useReducedMotion();
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const requestSequence = useRef(0);
  const previewRequestToken = useRef(0);
  const openRef = useRef(open);
  const importPendingRef = useRef(false);
  const collectionCache = useRef(
    new Map<string, StudioClipCollection["items"]>(),
  );
  const detailCache = useRef(new Map<string, StudioClipDetail>());
  const previewRuntime = useRef<PublicMidiPreviewRuntime | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<number | null>(null);
  const [source, setSource] = useState<Source>("owned");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [items, setItems] = useState<StudioClipCollection["items"]>([]);
  const [collectionStatus, setCollectionStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [collectionMessage, setCollectionMessage] = useState<string | null>(
    null,
  );
  const [preview, setPreview] = useState<PreviewState>(initialPreview);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [successHandoffPending, setSuccessHandoffPending] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [successTitle, setSuccessTitle] = useState<string | null>(null);
  const interactionLocked = importingId !== null || successHandoffPending;

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const clearPreviewTimer = useCallback(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = null;
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const stopPreview = useCallback(
    (nextStatus: PreviewState["status"] = "idle") => {
      previewRequestToken.current += 1;
      clearPreviewTimer();
      previewRuntime.current?.pause();
      setPreview((current) => ({
        patternVersionId:
          nextStatus === "idle" ? null : current.patternVersionId,
        status: nextStatus,
        message: null,
      }));
    },
    [clearPreviewTimer],
  );

  const requestClose = useCallback(() => {
    if (importPendingRef.current) return;
    requestSequence.current += 1;
    stopPreview();
    onOpenChange(false);
  }, [onOpenChange, stopPreview]);

  const loadCollection = useCallback(
    async (nextSource: Source, nextQuery: string) => {
      const normalizedQuery = nextQuery.trim();
      const cacheKey = `${nextSource}:${normalizedQuery.toLocaleLowerCase()}`;
      const cached = collectionCache.current.get(cacheKey);
      const sequence = ++requestSequence.current;
      setCollectionMessage(null);
      setImportMessage(null);
      stopPreview();
      if (cached) {
        setItems(cached);
        setCollectionStatus("ready");
        return;
      }
      setCollectionStatus("loading");
      const response = await listStudioClipCollectionAction({
        source: nextSource,
        query: normalizedQuery || null,
        limit: 100,
      });
      if (sequence !== requestSequence.current || !openRef.current) return;
      if (!response.ok) {
        setCollectionStatus("error");
        setCollectionMessage(studioClipFailureMessage(response.code));
        return;
      }
      collectionCache.current.set(cacheKey, response.collection.items);
      setItems(response.collection.items);
      setCollectionStatus("ready");
    },
    [stopPreview],
  );

  useEffect(() => {
    if (!open) {
      requestSequence.current += 1;
      previewRequestToken.current += 1;
      clearPreviewTimer();
      previewRuntime.current?.pause();
      return;
    }
    const timer = window.setTimeout(
      () => void loadCollection(source, appliedQuery),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [appliedQuery, clearPreviewTimer, loadCollection, open, source]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => panel?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !importPendingRef.current) {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hidden);
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open, requestClose, triggerRef]);

  useEffect(
    () => () => {
      previewRequestToken.current += 1;
      importPendingRef.current = false;
      clearPreviewTimer();
      clearCloseTimer();
      previewRuntime.current?.dispose();
    },
    [clearCloseTimer, clearPreviewTimer],
  );

  async function togglePreview(item: StudioClipItem) {
    if (!item.canImport || importPendingRef.current) return;
    if (
      preview.patternVersionId === item.patternVersionId &&
      preview.status === "playing"
    ) {
      stopPreview("paused");
      return;
    }
    stopPreview();
    const requestToken = previewRequestToken.current;
    setPreview({
      patternVersionId: item.patternVersionId,
      status: "loading",
      message: null,
    });
    let detail = detailCache.current.get(item.patternVersionId);
    if (!detail) {
      const response = await getStudioClipDetailAction({
        patternVersionId: item.patternVersionId,
      });
      if (
        requestToken !== previewRequestToken.current ||
        !openRef.current ||
        importPendingRef.current
      )
        return;
      if (!response.ok) {
        setPreview({
          patternVersionId: item.patternVersionId,
          status: "error",
          message: studioClipFailureMessage(response.code),
        });
        return;
      }
      detail = response.detail;
      detailCache.current.set(item.patternVersionId, detail);
    }
    if (
      requestToken !== previewRequestToken.current ||
      !openRef.current ||
      importPendingRef.current
    )
      return;
    if (!detail.pattern || !detail.metadata.preset) {
      setPreview({
        patternVersionId: item.patternVersionId,
        status: "error",
        message:
          studioClipAvailabilityMessage(detail.metadata) ??
          "This exact clip is not available for preview.",
      });
      return;
    }
    let runtime: PublicMidiPreviewRuntime | null = null;
    try {
      runtime = new PublicMidiPreviewRuntime();
      await runtime.prepare(toPreviewEvents(detail));
      if (
        requestToken !== previewRequestToken.current ||
        !openRef.current ||
        importPendingRef.current
      ) {
        runtime.dispose();
        return;
      }
      previewRuntime.current?.dispose();
      previewRuntime.current = runtime;
      window.dispatchEvent(
        new CustomEvent("openmidi:preview-play", {
          detail: { instanceId: `studio-clip:${item.patternVersionId}` },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("openmidi:public-midi-preview-play", {
          detail: { instanceId: `studio-clip:${item.patternVersionId}` },
        }),
      );
      await runtime.play(0);
      if (
        requestToken !== previewRequestToken.current ||
        !openRef.current ||
        importPendingRef.current
      ) {
        runtime.dispose();
        if (previewRuntime.current === runtime) previewRuntime.current = null;
        return;
      }
      const durationMs = Math.ceil(
        (detail.pattern.durationTicks * 60_000) / (120 * 480),
      );
      const activeRuntime = runtime;
      previewTimer.current = setTimeout(() => {
        activeRuntime.pause();
        setPreview(initialPreview);
      }, durationMs + 80);
      setPreview({
        patternVersionId: item.patternVersionId,
        status: "playing",
        message: null,
      });
    } catch {
      runtime?.dispose();
      if (previewRuntime.current === runtime) previewRuntime.current = null;
      if (
        requestToken !== previewRequestToken.current ||
        !openRef.current ||
        importPendingRef.current
      )
        return;
      setPreview({
        patternVersionId: item.patternVersionId,
        status: "error",
        message: "The local MIDI preview could not start. Try again.",
      });
    }
  }

  async function importClip(item: StudioClipItem) {
    if (!item.canImport || importPendingRef.current) return;
    importPendingRef.current = true;
    setImportingId(item.patternVersionId);
    setImportMessage(null);
    setSuccessTitle(null);
    stopPreview();
    const authority = await prepareImport();
    if (!authority.ok) {
      importPendingRef.current = false;
      setImportingId(null);
      setImportMessage(authority.message);
      return;
    }
    const response = await importStudioClipAction({
      patternVersionId: item.patternVersionId,
      source: item.source,
      workspaceId: authority.workspaceId,
      requestId: crypto.randomUUID(),
      expectedWorkspaceLockVersion: authority.expectedWorkspaceLockVersion,
      startTick: authority.startTick,
    });
    if (!response.ok) {
      importPendingRef.current = false;
      setImportingId(null);
      setImportMessage(studioClipFailureMessage(response.code));
      onImportFailure(response.code);
      return;
    }
    setSuccessTitle(item.patternName);
    setImportingId(null);
    setSuccessHandoffPending(true);
    clearCloseTimer();
    closeTimer.current = window.setTimeout(
      () => {
        closeTimer.current = null;
        onOpenChange(false);
        requestAnimationFrame(() => {
          try {
            onImported(response.result);
          } finally {
            importPendingRef.current = false;
            setSuccessHandoffPending(false);
            setSuccessTitle(null);
          }
        });
      },
      reduce ? 0 : 420,
    );
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (importPendingRef.current) return;
    stopPreview();
    setAppliedQuery(query.trim());
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="studio-clip-drawer"
          className="fixed inset-0 z-[80] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
        >
          <button
            type="button"
            aria-label="Close clip collection"
            className="bg-canvas/72 absolute inset-0 h-full w-full backdrop-blur-[3px]"
            onClick={requestClose}
          />
          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={-1}
            data-studio-clip-drawer
            initial={
              reduce ? { opacity: 0 } : { opacity: 0, x: 24, y: 0, scale: 0.99 }
            }
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={
              reduce ? { opacity: 0 } : { opacity: 0, x: 24, y: 0, scale: 0.99 }
            }
            transition={{
              duration: reduce ? 0 : 0.24,
              ease: [0.2, 0.8, 0.2, 1],
            }}
            className="border-strong bg-surface/96 absolute inset-y-2 right-2 flex w-[min(30rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-[1.5rem] border shadow-[0_28px_90px_-28px_rgb(0_0_0/0.9)] backdrop-blur-xl max-sm:inset-x-0 max-sm:top-auto max-sm:right-auto max-sm:bottom-0 max-sm:max-h-[calc(100dvh-0.5rem)] max-sm:w-full max-sm:rounded-t-[1.5rem] max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0"
          >
            <div className="from-accent/18 via-berry/8 border-subtle border-b bg-linear-to-br to-transparent px-4 pt-3 pb-4 sm:px-5">
              <div
                aria-hidden
                className="bg-ink/20 mx-auto mb-2 h-1 w-10 rounded-full sm:hidden"
              />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-accent font-mono text-[10px] tracking-[0.2em] uppercase">
                    Studio collection
                  </p>
                  <h2
                    id={titleId}
                    className="mt-1 text-xl font-semibold tracking-tight"
                  >
                    Add from clips
                  </h2>
                  <p
                    id={descriptionId}
                    className="text-muted mt-1 max-w-[40ch] text-sm leading-5"
                  >
                    Preview an exact version, then place it on a new track at
                    the playhead.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close Add from clips"
                  title="Close"
                  disabled={interactionLocked}
                  onClick={requestClose}
                  className="border-strong text-muted hover:border-accent hover:text-accent grid size-11 shrink-0 place-items-center rounded-full border text-lg disabled:opacity-40"
                >
                  <FiX aria-hidden />
                </button>
              </div>

              <div
                role="tablist"
                aria-label="Clip sources"
                className="border-subtle bg-surface-soft/70 mt-4 grid grid-cols-2 rounded-full border p-1"
              >
                {(
                  [
                    ["owned", "My clips"],
                    ["saved", "Saved clips"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={source === value}
                    aria-controls={`${titleId}-${value}`}
                    id={`${titleId}-${value}-tab`}
                    disabled={interactionLocked}
                    onClick={() => {
                      if (value === source) return;
                      stopPreview();
                      setSource(value);
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key !== "ArrowLeft" &&
                        event.key !== "ArrowRight"
                      )
                        return;
                      event.preventDefault();
                      const next = value === "owned" ? "saved" : "owned";
                      stopPreview();
                      setSource(next);
                      document
                        .getElementById(`${titleId}-${next}-tab`)
                        ?.focus();
                    }}
                    className={`min-h-11 rounded-full px-3 text-sm font-semibold transition-colors ${
                      source === value
                        ? "bg-ink/10 text-ink shadow-sm"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <form
                role="search"
                aria-label={`Search ${source === "owned" ? "My clips" : "Saved clips"}`}
                className="mt-3 flex gap-2"
                onSubmit={submitSearch}
              >
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">Search clips</span>
                  <FiSearch
                    aria-hidden
                    className="text-muted absolute top-1/2 left-3 -translate-y-1/2"
                  />
                  <input
                    value={query}
                    maxLength={80}
                    disabled={interactionLocked}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Title or creator"
                    className="border-strong bg-canvas/70 min-h-11 w-full rounded-full border pr-3 pl-10 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  disabled={interactionLocked}
                  className="border-strong hover:border-accent min-h-11 rounded-full border px-4 text-sm font-semibold"
                >
                  Search
                </button>
              </form>
            </div>

            <div
              id={`${titleId}-${source}`}
              role="tabpanel"
              aria-labelledby={`${titleId}-${source}-tab`}
              aria-busy={collectionStatus === "loading"}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
            >
              <div className="sr-only" role="status" aria-live="polite">
                {collectionStatus === "loading"
                  ? "Loading clips"
                  : successTitle
                    ? `${successTitle} added to the arrangement`
                    : (collectionMessage ?? importMessage ?? "")}
              </div>

              {successTitle && (
                <div className="border-accent/40 from-accent/16 to-accent-2/8 rounded-card mb-3 flex items-center gap-3 border bg-linear-to-r p-4">
                  <span className="cta-gradient grid size-10 shrink-0 place-items-center rounded-full">
                    <FiCheck aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold">Added to the arrangement</p>
                    <p className="text-muted truncate text-sm">
                      {successTitle} is ready at the playhead.
                    </p>
                  </div>
                </div>
              )}

              {(collectionMessage || importMessage) && (
                <div
                  role="alert"
                  className="border-danger/35 bg-danger/7 text-danger rounded-card mb-3 flex gap-3 border p-3 text-sm leading-5"
                >
                  <FiAlertCircle
                    aria-hidden
                    className="mt-0.5 shrink-0 text-lg"
                  />
                  <div>
                    <p>{importMessage ?? collectionMessage}</p>
                    {collectionStatus === "error" && (
                      <button
                        type="button"
                        onClick={() =>
                          void loadCollection(source, appliedQuery)
                        }
                        disabled={interactionLocked}
                        className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-full underline"
                      >
                        <FiRefreshCw aria-hidden /> Try again
                      </button>
                    )}
                  </div>
                </div>
              )}

              {collectionStatus === "loading" ? (
                <ClipCollectionLoading />
              ) : collectionStatus === "ready" && items.length === 0 ? (
                <div className="border-subtle bg-surface-soft/55 rounded-card flex min-h-48 flex-col items-center justify-center border border-dashed p-6 text-center">
                  <FiMusic aria-hidden className="text-accent-2 text-2xl" />
                  <h3 className="mt-3 font-semibold">
                    {appliedQuery
                      ? "No clips match that search"
                      : source === "owned"
                        ? "No owned clips yet"
                        : "No saved clips yet"}
                  </h3>
                  <p className="text-muted mt-1 max-w-[34ch] text-sm leading-5">
                    {appliedQuery
                      ? "Try a title or creator with fewer words."
                      : source === "owned"
                        ? "Freeze a MIDI pattern in any of your projects and it will appear here."
                        : "Save a reusable exact version from the MIDI library first."}
                  </p>
                </div>
              ) : (
                <ul
                  aria-label={`${source === "owned" ? "My" : "Saved"} clip results`}
                  className="space-y-2"
                >
                  {items.map((item) => (
                    <li key={item.patternVersionId}>
                      <ClipCollectionItem
                        item={item}
                        preview={preview}
                        importing={importingId === item.patternVersionId}
                        importDisabled={interactionLocked}
                        onPreview={() => void togglePreview(item)}
                        onImport={() => void importClip(item)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function ClipCollectionItem({
  item,
  preview,
  importing,
  importDisabled,
  onPreview,
  onImport,
}: {
  item: StudioClipItem;
  preview: PreviewState;
  importing: boolean;
  importDisabled: boolean;
  onPreview: () => void;
  onImport: () => void;
}) {
  const unavailable = studioClipAvailabilityMessage(item);
  const previewing =
    preview.patternVersionId === item.patternVersionId &&
    preview.status === "playing";
  const previewLoading =
    preview.patternVersionId === item.patternVersionId &&
    preview.status === "loading";
  const previewError =
    preview.patternVersionId === item.patternVersionId &&
    preview.status === "error";

  return (
    <article
      data-clip-version={item.patternVersionId}
      className={`rounded-card border p-3.5 transition-colors ${
        item.canImport
          ? "border-subtle bg-surface-raised/72 hover:border-accent/45"
          : "border-subtle bg-surface-soft/65"
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <button
          type="button"
          onClick={onPreview}
          disabled={!item.canImport || previewLoading || importDisabled}
          aria-label={
            previewing
              ? `Pause ${item.patternName}`
              : `${previewError ? "Retry preview" : "Preview"} ${item.patternName}`
          }
          title={unavailable ?? "Browser-local MIDI preview"}
          className={`grid size-11 shrink-0 place-items-center rounded-full border text-base ${
            previewing
              ? "cta-gradient border-transparent"
              : "border-strong text-accent-2 hover:border-accent"
          } disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {previewLoading ? (
            <FiLoader aria-hidden className="animate-spin" />
          ) : previewing ? (
            <FiPause aria-hidden />
          ) : previewError ? (
            <FiRefreshCw aria-hidden />
          ) : (
            <FiPlay aria-hidden className="ml-0.5" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-semibold" title={item.patternName}>
                {item.patternName}
              </h3>
              <p
                className="text-muted truncate text-xs"
                title={item.creatorCreditName}
              >
                by {item.creatorCreditName} · v{item.versionNumber}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2 py-1 font-mono text-[9px] tracking-wide uppercase ${
                item.canImport
                  ? "border-accent/30 text-accent"
                  : "border-strong text-muted"
              }`}
            >
              {item.canImport ? "Ready" : "Unavailable"}
            </span>
          </div>
          <div className="text-muted mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px]">
            <span className="inline-flex items-center gap-1">
              <FiClock aria-hidden />{" "}
              {formatStudioClipDuration(item.durationTicks)}
            </span>
            <span>{item.noteCount} notes</span>
            {item.preset && <span>{item.preset.name}</span>}
          </div>
          <p className="text-muted mt-1.5 flex items-center gap-1.5 text-[11px]">
            {item.source === "owned" ? (
              <FiUser aria-hidden />
            ) : (
              <FiFolderPlus aria-hidden />
            )}
            {studioClipContext(item)}
            {item.hasLineage && <FiGitBranch aria-hidden />}
          </p>
        </div>
      </div>

      {(unavailable || previewError) && (
        <p
          className={`mt-3 text-xs leading-5 ${previewError ? "text-danger" : "text-muted"}`}
        >
          {previewError ? preview.message : unavailable}
        </p>
      )}

      <button
        type="button"
        onClick={onImport}
        disabled={!item.canImport || importDisabled}
        className={`mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold ${
          item.canImport ? "cta-gradient" : "border-strong text-muted border"
        } disabled:cursor-not-allowed disabled:opacity-45`}
      >
        {importing ? (
          <>
            <FiLoader aria-hidden className="animate-spin" /> Adding at
            playhead…
          </>
        ) : (
          <>
            <FiFolderPlus aria-hidden /> Add as new track
          </>
        )}
      </button>
    </article>
  );
}

function ClipCollectionLoading() {
  return (
    <div aria-hidden className="space-y-2">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="border-subtle bg-surface-raised/55 rounded-card animate-pulse border p-4"
        >
          <div className="flex gap-3">
            <div className="bg-ink/8 size-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="bg-ink/10 h-4 w-2/3 rounded-full" />
              <div className="bg-ink/7 h-3 w-1/2 rounded-full" />
              <div className="bg-ink/7 h-3 w-3/4 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
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
