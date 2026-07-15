import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MutableStudioLifecycle } from "../switch-coordinator";
import type { ProjectSummaryPage } from "@/features/projects/types";
import {
  StudioShell,
  useStudioFileActions,
  useStudioLifecycleRegistration,
} from "./studio-shell.client";

const navigation = vi.hoisted(() => ({
  pathname: "/studio",
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push }),
}));

vi.mock("@/features/studio/studio-actions", () => ({
  listStudioProjectsAction: vi.fn(),
}));

function AlternateStudioSurface() {
  useStudioLifecycleRegistration(
    new MutableStudioLifecycle({
      status: "saved",
      generation: 0,
      acknowledgedGeneration: 0,
      recoveryAvailable: false,
    }),
  );
  return <p>Alternate studio surface</p>;
}

describe("Studio lifecycle registration", () => {
  beforeEach(() => {
    navigation.pathname = "/studio";
    navigation.push.mockReset();
  });
  afterEach(cleanup);

  it("keeps alternate read-only surfaces usable outside the canonical shell", () => {
    expect(() => render(<AlternateStudioSurface />)).not.toThrow();
  });

  it("presents project lifecycle commands in File with blank-session reasons", () => {
    render(
      <StudioShell
        initialProjects={emptyProjects}
        projectOptions={null}
        createAction={null}
      >
        <p>Blank workspace</p>
      </StudioShell>,
    );

    fireEvent.click(screen.getByText("File"));

    expect(screen.getByRole("button", { name: "Open project" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(
      screen.getByText("Open an editable project before saving."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close project" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Download / export…" }),
    ).toBeDisabled();
  });

  it("routes File Save and Download to the registered selected session", () => {
    navigation.pathname = "/studio/10000000-0000-4000-8000-000000000123";
    const save = vi.fn();
    const openExport = vi.fn();
    const lifecycle = new MutableStudioLifecycle({
      status: "dirty",
      generation: 2,
      acknowledgedGeneration: 1,
      recoveryAvailable: true,
    });
    lifecycle.configure({
      requestSave: save,
      preserveRecovery: async () => true,
      dispose: async () => undefined,
    });

    function SelectedSession() {
      useStudioLifecycleRegistration(lifecycle, { editable: true });
      useStudioFileActions({ openExport });
      return <p>Selected workspace</p>;
    }

    render(
      <StudioShell
        initialProjects={emptyProjects}
        projectOptions={null}
        createAction={null}
      >
        <SelectedSession />
      </StudioShell>,
    );

    fireEvent.click(screen.getByText("File"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(save).toHaveBeenCalledWith(2);

    fireEvent.click(screen.getByText("File"));
    fireEvent.click(screen.getByRole("button", { name: "Download / export…" }));
    expect(openExport).toHaveBeenCalledOnce();
  });
});

const emptyProjects: ProjectSummaryPage = {
  projects: [],
  nextCursor: null,
};
