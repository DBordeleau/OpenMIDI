"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
  FiCheck,
  FiChevronDown,
  FiExternalLink,
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

type StudioShellContextValue = {
  requestNavigation(target: string): void;
  registerLifecycle(
    port: StudioSessionLifecyclePort,
    options: { editable: boolean },
  ): () => void;
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
  const reduce = useReducedMotion();
  const [panel, setPanel] = useState<"browser" | "creator" | null>(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [editableSession, setEditableSession] = useState(false);
  const [lifecycleSnapshot, setLifecycleSnapshot] =
    useState<StudioLifecycleSnapshot | null>(null);
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
  const activeProject = projects.find(
    (project) => project.id === activeProjectId,
  );
  const projectLabel = activeProjectId
    ? (activeProject?.title ?? "Current project")
    : "No project open";

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
    switching: Boolean(switchTarget),
  };

  useEffect(() => {
    if (!projectMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target as Element | null)?.closest("[data-project-menu]"))
        setProjectMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProjectMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [projectMenuOpen]);

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

  function saveSession() {
    const port = lifecycle.current;
    if (!port || saveDisabledReason) return;
    port.requestSave(port.getSnapshot().generation);
  }

  function openProject(target: string) {
    setProjectMenuOpen(false);
    requestNavigation(target);
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
      <header className="border-subtle bg-surface/95 rounded-card relative z-40 flex min-h-11 flex-wrap items-center gap-1 border px-2 py-1 shadow-lg backdrop-blur-sm">
        <button
          type="button"
          onClick={() => requestNavigation("/studio")}
          aria-label="Jam Session Studio"
          title="Jam Session Studio"
          className="hover:bg-surface-raised rounded-control mr-1 flex min-h-9 items-center gap-2 px-2 font-bold tracking-tight transition-colors"
        >
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-full"
            style={{
              background:
                "linear-gradient(140deg,var(--color-accent),var(--color-accent-2))",
              boxShadow: "0 0 12px rgb(255 175 120 / 0.6)",
            }}
          />
          <span className="hidden text-sm sm:inline">Studio</span>
        </button>

        <div className="relative" data-project-menu>
          <button
            type="button"
            onClick={() => setProjectMenuOpen((open) => !open)}
            disabled={!initialProjects || Boolean(switchTarget)}
            aria-haspopup="menu"
            aria-expanded={projectMenuOpen}
            aria-label={`Project menu — ${projectLabel}`}
            title="Projects"
            className="border-strong hover:border-accent hover:text-accent rounded-control flex min-h-9 min-w-0 items-center gap-2 border px-3 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <FiFolder aria-hidden className="text-muted shrink-0" />
            <span className="max-w-56 truncate">{projectLabel}</span>
            <FiChevronDown
              aria-hidden
              className={`text-muted shrink-0 transition-transform ${projectMenuOpen ? "rotate-180" : ""}`}
            />
          </button>
          <AnimatePresence>
            {projectMenuOpen && (
              <motion.div
                role="menu"
                aria-label="Projects"
                initial={
                  reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={
                  reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }
                }
                transition={{
                  duration: reduce ? 0 : 0.16,
                  ease: [0.2, 0.8, 0.2, 1],
                }}
                className="border-strong bg-surface rounded-control absolute top-11 left-0 z-50 w-80 max-w-[calc(100vw-2rem)] origin-top-left border p-2 shadow-2xl"
              >
                <ProjectMenuButton
                  icon={<FiPlus aria-hidden />}
                  accent
                  disabled={
                    !projectOptions || !createAction || Boolean(switchTarget)
                  }
                  onClick={() => {
                    setProjectMenuOpen(false);
                    setPanel("creator");
                  }}
                >
                  New project
                </ProjectMenuButton>
                <div className="border-subtle my-2 border-t" />
                <p className="text-muted px-3 pb-1 font-mono text-[10px] tracking-widest uppercase">
                  {projects.length ? "Switch to" : "Projects"}
                </p>
                <div className="max-h-64 overflow-y-auto">
                  {projects.length ? (
                    projects.slice(0, 8).map((project) => {
                      const current = project.id === activeProjectId;
                      return (
                        <button
                          key={project.id}
                          type="button"
                          role="menuitem"
                          disabled={current || Boolean(switchTarget)}
                          onClick={() => openProject(`/studio/${project.id}`)}
                          className="hover:bg-surface-raised rounded-control flex min-h-10 w-full items-center gap-2 px-3 text-left text-sm transition-colors disabled:cursor-default"
                        >
                          <span
                            className="text-accent w-4 shrink-0"
                            aria-hidden
                          >
                            {current ? <FiCheck /> : null}
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {project.title}
                          </span>
                          {current && (
                            <span className="text-muted shrink-0 text-[10px] tracking-wide uppercase">
                              Current
                            </span>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-muted px-3 py-2 text-sm">
                      No projects yet.
                    </p>
                  )}
                </div>
                {initialProjects && (
                  <ProjectMenuButton
                    icon={<FiFolder aria-hidden />}
                    disabled={Boolean(switchTarget)}
                    onClick={() => {
                      setProjectMenuOpen(false);
                      setPanel("browser");
                    }}
                  >
                    Browse all projects…
                  </ProjectMenuButton>
                )}
                {activeProjectId && (
                  <>
                    <div className="border-subtle my-2 border-t" />
                    <ProjectMenuButton
                      icon={<FiExternalLink aria-hidden />}
                      disabled={Boolean(switchTarget)}
                      onClick={() => {
                        setProjectMenuOpen(false);
                        requestNavigation(`/projects/${activeProjectId}`);
                      }}
                    >
                      View project page
                    </ProjectMenuButton>
                    <ProjectMenuButton
                      icon={<FiX aria-hidden />}
                      disabled={Boolean(switchTarget)}
                      onClick={() => openProject("/studio")}
                    >
                      Close project
                    </ProjectMenuButton>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {editableSession && (
          <button
            type="button"
            onClick={saveSession}
            disabled={Boolean(saveDisabledReason)}
            title={saveDisabledReason ?? "Save the arrangement"}
            className="border-strong hover:border-accent hover:text-accent ml-1 inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors disabled:opacity-40"
          >
            <FiSave aria-hidden /> Save
          </button>
        )}

        <span
          className="text-muted ml-auto hidden pr-1 text-xs sm:inline"
          role="status"
        >
          {switchTarget
            ? "Switching…"
            : activeProjectId
              ? "Project session"
              : "Blank session"}
        </span>
      </header>

      {switchTarget && (
        <p className="text-muted" role="status" aria-live="polite">
          Saving and closing this session before opening {switchTarget}…
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>

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

function ProjectMenuButton({
  icon,
  children,
  disabled,
  accent,
  onClick,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  disabled: boolean;
  accent?: boolean;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className="hover:bg-surface-raised rounded-control flex min-h-10 w-full items-center gap-3 px-3 text-left text-sm font-semibold transition-colors disabled:opacity-40"
      disabled={disabled}
      onClick={onClick}
    >
      <span className={accent ? "text-accent" : "text-muted"} aria-hidden>
        {icon}
      </span>
      {children}
    </button>
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
