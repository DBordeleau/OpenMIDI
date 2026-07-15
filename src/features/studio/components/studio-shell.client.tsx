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
import { FiFolder, FiPlus, FiX } from "react-icons/fi";
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
} from "@/features/studio/switch-coordinator";

type StudioShellContextValue = {
  openBrowser(): void;
  openCreator(): void;
  requestNavigation(target: string): void;
  registerLifecycle(port: StudioSessionLifecyclePort): () => void;
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
  const [panel, setPanel] = useState<"browser" | "creator" | null>(null);
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

  const registerLifecycle = useCallback((port: StudioSessionLifecyclePort) => {
    lifecycle.current = port;
    return () => {
      if (lifecycle.current === port) lifecycle.current = null;
    };
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
    openBrowser: () => setPanel("browser"),
    openCreator: () => setPanel("creator"),
    requestNavigation,
    registerLifecycle,
    switching: Boolean(switchTarget),
  };

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
      <header className="border-subtle bg-surface/90 rounded-card flex flex-wrap items-center justify-between gap-4 border px-5 py-4 shadow-lg backdrop-blur-sm sm:px-6">
        <div>
          <button
            type="button"
            onClick={() => requestNavigation("/studio")}
            className="hover:text-accent text-left text-lg font-bold tracking-tight transition-colors"
          >
            Jam Session Studio
          </button>
          <p className="text-muted mt-1 text-sm">
            One project, one live session, all the music in context.
          </p>
        </div>
        <nav aria-label="Studio" className="flex flex-wrap gap-2">
          {activeProjectId && (
            <button
              type="button"
              disabled={Boolean(switchTarget)}
              onClick={() => requestNavigation("/studio")}
              className="border-strong hover:border-accent hover:text-accent inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <FiX aria-hidden /> Close project
            </button>
          )}
          <button
            type="button"
            disabled={!initialProjects || Boolean(switchTarget)}
            onClick={() => setPanel("browser")}
            className="border-strong hover:border-accent hover:text-accent inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <FiFolder aria-hidden /> Open project
          </button>
          <button
            type="button"
            disabled={!projectOptions || !createAction || Boolean(switchTarget)}
            onClick={() => setPanel("creator")}
            className="cta-gradient text-accent-contrast inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-transform hover:-translate-y-px disabled:opacity-50"
          >
            <FiPlus aria-hidden /> New project
          </button>
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

export function StudioStartActions() {
  const shell = useStudioShell();
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <button
        type="button"
        onClick={shell.openCreator}
        className="cta-gradient text-accent-contrast inline-flex min-h-11 items-center rounded-full px-5 py-3 font-semibold transition-transform hover:-translate-y-px"
      >
        New project
      </button>
      <button
        type="button"
        onClick={shell.openBrowser}
        className="border-strong bg-surface-raised hover:border-accent hover:text-accent inline-flex min-h-11 items-center rounded-full border px-5 py-3 font-semibold transition-colors"
      >
        Open project
      </button>
    </div>
  );
}

export function useStudioLifecycleRegistration(
  port: StudioSessionLifecyclePort,
) {
  const shell = useContext(StudioShellContext);
  const registerLifecycle = shell?.registerLifecycle;
  useEffect(() => registerLifecycle?.(port), [port, registerLifecycle]);
}

function useStudioShell() {
  const value = useContext(StudioShellContext);
  if (!value) throw new Error("studio_shell_unavailable");
  return value;
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
