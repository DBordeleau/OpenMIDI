import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MutableStudioLifecycle } from "../switch-coordinator";
import type { ProjectSummaryPage } from "@/features/projects/types";
import {
  StudioShell,
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

  it("opens the project menu and gates creation for an empty blank session", () => {
    render(
      <StudioShell
        initialProjects={emptyProjects}
        projectOptions={null}
        createAction={null}
      >
        <p>Blank workspace</p>
      </StudioShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Project menu/ }));

    expect(
      screen.getByRole("menuitem", { name: "New project" }),
    ).toBeDisabled();
    expect(screen.getByText("No projects yet.")).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Browse all projects…" }),
    ).toBeEnabled();
    // No project is open, so a Save control is not offered on a blank session.
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("offers a top-bar Save that routes to the registered editable session", () => {
    navigation.pathname = "/studio/10000000-0000-4000-8000-000000000123";
    const save = vi.fn();
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

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(save).toHaveBeenCalledWith(2);
  });
});

const emptyProjects: ProjectSummaryPage = {
  projects: [],
  nextCursor: null,
};
