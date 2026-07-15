"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  FiChevronDown,
  FiDownload,
  FiFolder,
  FiPlus,
  FiSave,
  FiX,
} from "react-icons/fi";
import { ProjectForm } from "@/features/projects/project-form";
import type { ProjectFormState } from "@/features/projects/actions";
import type {
  ProjectFormOptions,
  ProjectSummary,
  ProjectSummaryPage,
} from "@/features/projects/types";
import { listStudioProjectsAction } from "@/features/studio/studio-actions";
import {
  coordinateStudioSave,
  coordinateStudioExit,
  type StudioLeaveDecision,
  type StudioSessionLifecyclePort,
  type StudioLifecycleSnapshot,
} from "@/features/studio/switch-coordinator";

type StudioFileActions = {
  openExport?(): void;
};

type StudioShellContextValue = {
  requestNavigation(target: string): void;
  registerLifecycle(
    port: StudioSessionLifecyclePort,
    options: { editable: boolean },
  ): () => void;
  registerFileActions(actions: StudioFileActions): () => void;
  switching: boolean;
};

const StudioShellContext = createContext<StudioShellContextValue | null>(null);

export function StudioShell({
  children,
  initialProjects,
  projectOptions,
  createAction,
}: {
  children: React.ReactNode;
  initialProjects: ProjectSummaryPage | null;
  projectOptions: ProjectFormOptions | null;
  createAction:
    | ((state: ProjectFormState, data: FormData) => Promise<ProjectFormState>)
    | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const lifecycle = useRef<StudioSessionLifecyclePort | null>(null);
  const lifecycleSubscription = useRef<(() => void) | null>(null);
  const fileMenuRef = useRef<HTMLDetailsElement>(null);
  const [panel, setPanel] = useState<"browser" | "creator" | null>(null);
  const [editableSession, setEditableSession] = useState(false);
  const [lifecycleSnapshot, setLifecycleSnapshot] =
    useState<StudioLifecycleSnapshot | null>(null);
  const [fileActions, setFileActions] = useState<StudioFileActions>({});
  const [projects, setProjects] = useState(initialProjects?.projects ?? []);
  const [nextCursor, setNextCursor] = useState(
    initialProjects?.nextCursor ?? null,
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [switchTarget, setSwitchTarget] = useState<string | null>(null);
  const [decision, setDecision] = useState<{
    kind: StudioLeaveDecision;
    resolve(value: boolean): void;
  } | null>(null);
  const activeProjectId = pathname.match(/^\/studio\/([0-9a-f-]+)$/i)?.[1];

  const registerLifecycle = useCallback(
    (port: StudioSessionLifecyclePort, options: { editable: boolean }) => {
      lifecycleSubscription.current?.();
      lifecycle.current = port;
      setEditableSession(options.editable);
      setLifecycleSnapshot(port.getSnapshot());
      const unsubscribe = port.subscribe(() =>
        setLifecycleSnapshot(port.getSnapshot()),
      );
      lifecycleSubscription.current = unsubscribe;
      return () => {
        if (lifecycle.current !== port) return;
        unsubscribe();
        lifecycleSubscription.current = null;
        lifecycle.current = null;
        setEditableSession(false);
        setLifecycleSnapshot(null);
      };
    },
    [],
  );

  const registerFileActions = useCallback((actions: StudioFileActions) => {
    setFileActions(actions);
    return () =>
      setFileActions((current) => (current === actions ? {} : current));
  }, []);

  const confirmLeave = useCallback(
    (kind: StudioLeaveDecision) =>
      new Promise<boolean>((resolve) => setDecision({ kind, resolve })),
    [],
  );

  const requestNavigation = useCallback(
    (target: string) => {
      if (switchTarget || target === pathname) return;
      setSwitchTarget(target);
      void coordinateStudioExit(lifecycle.current, confirmLeave)
        .then((outcome) => {
          if (outcome === "left") {
            setPanel(null);
            router.push(target);
          }
        })
        .finally(() => setSwitchTarget(null));
    },
    [confirmLeave, pathname, router, switchTarget],
  );

  const context: StudioShellContextValue = {
    requestNavigation,
    registerLifecycle,
    registerFileActions,
    switching: Boolean(switchTarget),
  };

  const saveDisabledReason = !activeProjectId
    ? "Open an editable project before saving."
    : !editableSession
      ? "This Studio session is read-only."
      : lifecycleSnapshot?.status === "saving"
        ? "This arrangement is already saving."
        : lifecycleSnapshot?.status === "saved"
          ? "All arrangement changes are already saved."
          : lifecycleSnapshot?.status === "conflict"
            ? "Resolve the draft conflict before saving."
            : null;

  function closeFileMenu() {
    fileMenuRef.current?.removeAttribute("open");
  }

  function saveSession() {
    const port = lifecycle.current;
    if (!port || saveDisabledReason) return;
    port.requestSave(port.getSnapshot().generation);
    closeFileMenu();
  }

  async function prepareCreation() {
    if (switchTarget) return false;
    setSwitchTarget("the new project");
    try {
      return await coordinateStudioSave(lifecycle.current, confirmLeave);
    } finally {
      setSwitchTarget(null);
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadError(false);
    try {
      const page = await listStudioProjectsAction(nextCursor);
      setProjects((current) => [
        ...current,
        ...page.projects.filter(
          (candidate) =>
            !current.some((project) => project.id === candidate.id),
        ),
      ]);
      setNextCursor(page.nextCursor);
    } catch {
      setLoadError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <StudioShellContext.Provider value={context}>
      <header className="border-subtle bg-surface/90 rounded-card relative z-40 flex min-h-14 flex-wrap items-center gap-x-5 gap-y-2 border px-3 py-2 shadow-lg backdrop-blur-sm sm:px-4">
        <div className="mr-auto flex items-center gap-4">
          <button
            type="button"
            onClick={() => requestNavigation("/studio")}
            className="hover:text-accent text-left font-bold tracking-tight transition-colors"
          >
            Jam Session Studio
          </button>
          <span className="border-subtle text-muted hidden border-l pl-4 text-xs sm:inline">
            {activeProjectId ? "Project session" : "Blank session"}
          </span>
        </div>
        <nav aria-label="Studio" className="flex items-center gap-1">
          <details ref={fileMenuRef} className="relative">
            <summary className="hover:bg-surface-raised rounded-control flex min-h-10 list-none items-center gap-1 px-3 text-sm font-semibold transition-colors">
              File <FiChevronDown aria-hidden className="text-muted" />
            </summary>
            <div className="border-strong bg-surface rounded-control absolute top-11 right-0 z-50 w-72 border p-2 shadow-2xl">
              <p className="text-muted px-3 pt-2 pb-1 font-mono text-[10px] tracking-widest uppercase">
                Project
              </p>
              <FileMenuButton
                icon={<FiPlus aria-hidden />}
                disabled={
                  !projectOptions || !createAction || Boolean(switchTarget)
                }
                reason="Project creation is unavailable for this account."
                onClick={() => {
                  closeFileMenu();
                  setPanel("creator");
                }}
              >
                New project
              </FileMenuButton>
              <FileMenuButton
                icon={<FiFolder aria-hidden />}
                disabled={!initialProjects || Boolean(switchTarget)}
                reason="The project browser is unavailable for this account."
                onClick={() => {
                  closeFileMenu();
                  setPanel("browser");
                }}
              >
                Open project
              </FileMenuButton>
              <div className="border-subtle my-2 border-t" />
              <FileMenuButton
                icon={<FiSave aria-hidden />}
                disabled={Boolean(saveDisabledReason) || Boolean(switchTarget)}
                reason={saveDisabledReason ?? "Studio is switching projects."}
                onClick={saveSession}
              >
                Save
              </FileMenuButton>
              <FileMenuButton
                icon={<FiX aria-hidden />}
                disabled={!activeProjectId || Boolean(switchTarget)}
                reason="No project is open."
                onClick={() => {
                  closeFileMenu();
                  requestNavigation("/studio");
                }}
              >
                Close project
              </FileMenuButton>
              <FileMenuButton
                icon={<FiDownload aria-hidden />}
                disabled={!fileActions.openExport || Boolean(switchTarget)}
                reason="Open a project with downloadable or exportable material first."
                onClick={() => {
                  closeFileMenu();
                  fileActions.openExport?.();
                }}
              >
                Download / export…
              </FileMenuButton>
            </div>
          </details>
          {activeProjectId ? (
            <button
              type="button"
              disabled={Boolean(switchTarget)}
              onClick={() => requestNavigation("/studio")}
              className="border-strong hover:border-accent hover:text-accent hidden min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-50 md:inline-flex"
            >
              <FiX aria-hidden /> Close project
            </button>
          ) : (
            <span className="text-muted hidden text-xs md:inline">
              File → New or Open to begin
            </span>
          )}
        </nav>
      </header>

      {switchTarget && (
        <p className="text-muted" role="status" aria-live="polite">
          Saving and closing this session before opening {switchTarget}…
        </p>
      )}

      {children}

      {panel === "browser" && (
        <StudioDialog title="Choose a project" onClose={() => setPanel(null)}>
          <p className="text-muted mt-2">
            Every project is authorized again when its Studio route opens.
          </p>
          <ProjectBrowser
            projects={projects}
            activeProjectId={activeProjectId}
            switching={Boolean(switchTarget)}
            onOpen={(projectId) => requestNavigation(`/studio/${projectId}`)}
          />
          {nextCursor && (
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void loadMore()}
              className="border-strong hover:border-accent mt-5 min-h-11 rounded-full border px-4 text-sm font-semibold disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "More projects"}
            </button>
          )}
          {loadError && (
            <p role="alert" className="text-danger mt-3">
              More projects could not be loaded. Try again.
            </p>
          )}
        </StudioDialog>
      )}

      {panel === "creator" && projectOptions && createAction && (
        <StudioDialog title="Create a project" onClose={() => setPanel(null)}>
          <p className="text-muted mt-2">
            Set the musical context, then open its private Studio workspace.
          </p>
          <ProjectForm
            action={createAction}
            options={projectOptions}
            beforeSubmit={prepareCreation}
          />
        </StudioDialog>
      )}

      {decision && (
        <StudioDialog
          title={
            decision.kind === "conflict"
              ? "This draft has a conflict"
              : "Changes are saved on this device"
          }
          onClose={() => {
            decision.resolve(false);
            setDecision(null);
          }}
        >
          <p className="text-muted mt-3 leading-7">
            {decision.kind === "conflict"
              ? "Jam Session will not overwrite the newer server draft. Stay to resolve it, or leave while keeping this local recovery copy."
              : "The server has not acknowledged these changes. Stay and retry, or leave while keeping the local recovery copy on this device."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              autoFocus
              className="border-strong hover:border-accent min-h-11 rounded-full border px-4 font-semibold"
              onClick={() => {
                decision.resolve(false);
                setDecision(null);
              }}
            >
              Stay in this project
            </button>
            <button
              type="button"
              className="cta-gradient text-accent-contrast min-h-11 rounded-full px-4 font-semibold"
              onClick={() => {
                decision.resolve(true);
                setDecision(null);
              }}
            >
              Leave with recovery
            </button>
          </div>
        </StudioDialog>
      )}
    </StudioShellContext.Provider>
  );
}

export function useStudioLifecycleRegistration(
  port: StudioSessionLifecyclePort,
  options: { editable: boolean } = { editable: false },
) {
  const shell = useContext(StudioShellContext);
  const registerLifecycle = shell?.registerLifecycle;
  const editable = options.editable;
  useEffect(
    () => registerLifecycle?.(port, { editable }),
    [editable, port, registerLifecycle],
  );
}

export function useStudioFileActions(actions: StudioFileActions) {
  const shell = useContext(StudioShellContext);
  const registerFileActions = shell?.registerFileActions;
  const openExport = actions.openExport;
  useEffect(
    () => registerFileActions?.({ openExport }),
    [openExport, registerFileActions],
  );
}

function FileMenuButton({
  icon,
  children,
  disabled,
  reason,
  onClick,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  disabled: boolean;
  reason: string;
  onClick(): void;
}) {
  const reasonId = useId();
  return (
    <>
      <button
        type="button"
        className="hover:bg-surface-raised rounded-control flex min-h-10 w-full items-center gap-3 px-3 text-left text-sm transition-colors disabled:opacity-40"
        disabled={disabled}
        aria-describedby={disabled ? reasonId : undefined}
        onClick={onClick}
      >
        <span className="text-muted" aria-hidden>
          {icon}
        </span>
        {children}
      </button>
      {disabled && (
        <span id={reasonId} className="sr-only">
          {reason}
        </span>
      )}
    </>
  );
}

function StudioDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose(): void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="rounded-card border-strong bg-canvas m-auto w-full max-w-3xl border p-6 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-2xl font-semibold">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close dialog"
            title="Close dialog"
            onClick={onClose}
            className="border-strong hover:border-accent hover:text-accent grid h-11 w-11 shrink-0 place-items-center rounded-full border text-lg"
          >
            <FiX aria-hidden />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

const accessLabels: Record<ProjectSummary["studioAccess"], string> = {
  owner_workspace: "Private owner workspace",
  contribution_workspace: "Private contribution workspace",
  workspace_available: "Editable workspace opens here",
  read_only: "Read-only published arrangement",
};

function ProjectBrowser({
  projects,
  activeProjectId,
  switching,
  onOpen,
}: {
  projects: ProjectSummary[];
  activeProjectId?: string;
  switching: boolean;
  onOpen(projectId: string): void;
}) {
  if (!projects.length)
    return (
      <div className="border-strong rounded-control mt-6 border border-dashed p-6 text-center">
        <p className="font-semibold">No projects yet.</p>
        <p className="text-muted mt-2 text-sm">
          Create one here to begin with an empty MIDI workspace.
        </p>
      </div>
    );
  return (
    <ul className="mt-6 space-y-3" aria-label="Authorized Studio projects">
      {projects.map((project) => {
        const current = project.id === activeProjectId;
        return (
          <li
            key={project.id}
            className="border-subtle bg-surface rounded-control flex flex-col gap-4 border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{project.title}</p>
              <p className="text-muted mt-1 text-sm">
                <span className="capitalize">{project.role}</span> ·{" "}
                {accessLabels[project.studioAccess]}
                {project.needsReview ? " · Review pending" : ""}
              </p>
              <p className="text-muted mt-1 text-xs">
                Updated{" "}
                <time dateTime={project.updatedAt}>
                  {new Date(project.updatedAt).toLocaleDateString()}
                </time>
              </p>
            </div>
            <button
              type="button"
              disabled={current || switching}
              onClick={() => onOpen(project.id)}
              className="border-strong hover:border-accent hover:text-accent min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold disabled:opacity-50"
            >
              {current ? "Current session" : "Open in Studio"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
