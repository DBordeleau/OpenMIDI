import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StaleDraftResolution } from "./stale-draft-resolution.client";

const reducedMotion = vi.hoisted(() => vi.fn(() => false));
const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));
const recovery = vi.hoisted(() => ({
  clear: vi.fn(),
  announce: vi.fn(),
}));
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: reducedMotion,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));
vi.mock("@/features/workspaces/midi-local-recovery.client", () => ({
  clearMidiLocalRecovery: recovery.clear,
  writeStudioResolutionAnnouncement: recovery.announce,
}));

const projectId = "10000000-0000-4000-8000-000000000123";
const viewerId = "10000000-0000-4000-8000-000000000124";
const workspaceId = "20000000-0000-4000-8000-000000000123";
const staleDraft = {
  baseRevisionId: "30000000-0000-4000-8000-000000000123",
  baseRevisionNumber: 1,
  currentRevisionId: "40000000-0000-4000-8000-000000000123",
  currentRevisionNumber: 2,
};

function renderResolution(
  overrides: Partial<React.ComponentProps<typeof StaleDraftResolution>> = {},
) {
  const props: React.ComponentProps<typeof StaleDraftResolution> = {
    projectId,
    projectTitle: "Night take",
    viewerId,
    workspaceId,
    staleDraft,
    prepareResolution: vi.fn().mockResolvedValue(4),
    onResolved: vi.fn(),
    onAuthorityConflict: vi.fn(),
    onFailure: vi.fn(),
    onDecisionOpenChange: vi.fn(),
    resolveAction: vi.fn(),
    ...overrides,
  };
  render(
    <>
      <button type="button">Before resolution</button>
      <div id="studio-source-slot" />
      <StaleDraftResolution {...props} />
    </>,
  );
  return props;
}

describe("StaleDraftResolution", () => {
  beforeEach(() => reducedMotion.mockReturnValue(false));
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("explains both revision authorities and keeps editing without mutation", async () => {
    const user = userEvent.setup();
    const props = renderResolution();
    const trigger = screen.getByRole("button", {
      name: /Draft based on revision 1.*Resolve/,
    });
    trigger.focus();
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", {
      name: "Resolve this older draft",
    });
    expect(dialog).toHaveTextContent(
      "Revision 2 was published while you were editing revision 1.",
    );
    expect(
      screen.getByRole("button", { name: "Continue from revision 2" }),
    ).toHaveFocus();

    await user.click(
      screen.getByRole("button", { name: "Keep editing for now" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(props.resolveAction).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it("contains focus, supports Escape, and remains operable with reduced motion", async () => {
    reducedMotion.mockReturnValue(true);
    const user = userEvent.setup();
    const props = renderResolution();
    await user.click(
      screen.getByRole("button", {
        name: /Draft based on revision 1.*Resolve/,
      }),
    );

    const close = screen.getByRole("button", {
      name: "Close draft resolution",
    });
    close.focus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Continue from revision 2" }),
    ).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(props.onDecisionOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("moves focus with each resolution step and returns it to the Resolve trigger", async () => {
    const user = userEvent.setup();
    renderResolution();
    const trigger = screen.getByRole("button", {
      name: /Draft based on revision 1.*Resolve/,
    });
    trigger.focus();
    await user.click(trigger);

    await user.click(
      screen.getByRole("button", { name: "Preserve draft as a fork" }),
    );
    expect(screen.getByLabelText("Private fork title")).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(
      screen.getByRole("button", { name: "Continue from revision 2" }),
    ).toHaveFocus();

    await user.click(
      screen.getByRole("button", { name: "Continue from revision 2" }),
    );
    expect(
      screen.getByRole("button", { name: "Start from revision 2" }),
    ).toHaveFocus();

    await user.click(
      screen.getByRole("button", { name: "Preserve as a fork instead" }),
    );
    expect(screen.getByLabelText("Private fork title")).toHaveFocus();

    await user.click(
      screen.getByRole("button", { name: "Close draft resolution" }),
    );
    expect(trigger).toHaveFocus();
  });

  it("requires a second confirmation before restarting from current authority", async () => {
    const user = userEvent.setup();
    const resolveAction = vi.fn().mockResolvedValue({
      ok: true,
      resolution: "restart_latest",
      targetProjectId: projectId,
      targetWorkspaceId: "50000000-0000-4000-8000-000000000123",
      targetBaseRevisionId: staleDraft.currentRevisionId,
      targetLockVersion: 1,
    });
    const props = renderResolution({ resolveAction });
    await user.click(
      screen.getByRole("button", {
        name: /Draft based on revision 1.*Resolve/,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Continue from revision 2" }),
    );

    expect(
      screen.getByText(/Your current draft will not be carried over/),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Start from revision 2" }),
    );

    await waitFor(() =>
      expect(resolveAction).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedWorkspaceLockVersion: 4,
          expectedBaseRevisionId: staleDraft.baseRevisionId,
          expectedCurrentRevisionId: staleDraft.currentRevisionId,
          resolution: "restart_latest",
          forkTitle: null,
        }),
      ),
    );
    expect(props.onResolved).toHaveBeenCalledWith(
      expect.objectContaining({ resolution: "restart_latest" }),
      null,
    );
    expect(recovery.clear).toHaveBeenCalledWith(viewerId, workspaceId);
    expect(navigation.push).toHaveBeenCalledWith(`/studio/${projectId}`);
  });

  it("validates the bounded fork title and carries it through the pending command", async () => {
    const user = userEvent.setup();
    let finish:
      ((value: Awaited<ReturnType<typeof resolveAction>>) => void) | undefined;
    const resolveAction = vi.fn(
      () =>
        new Promise<{
          ok: true;
          resolution: "preserve_as_fork";
          targetProjectId: string;
          targetWorkspaceId: string;
          targetBaseRevisionId: string;
          targetLockVersion: number;
        }>((resolve) => {
          finish = resolve;
        }),
    );
    const props = renderResolution({ resolveAction });
    await user.click(
      screen.getByRole("button", {
        name: /Draft based on revision 1.*Resolve/,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Preserve draft as a fork" }),
    );
    const title = screen.getByLabelText("Private fork title");
    expect(title).toHaveValue("Night take - recovered draft");
    await user.clear(title);
    await user.click(
      screen.getByRole("button", { name: "Create private fork" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a fork title between 1 and 120 characters.",
    );
    expect(resolveAction).not.toHaveBeenCalled();

    await user.type(title, "Night take rescue");
    await user.click(
      screen.getByRole("button", { name: "Create private fork" }),
    );
    expect(
      screen.getByRole("button", { name: "Creating private fork..." }),
    ).toBeDisabled();
    finish?.({
      ok: true,
      resolution: "preserve_as_fork",
      targetProjectId: "60000000-0000-4000-8000-000000000123",
      targetWorkspaceId: "70000000-0000-4000-8000-000000000123",
      targetBaseRevisionId: "80000000-0000-4000-8000-000000000123",
      targetLockVersion: 1,
    });
    await waitFor(() =>
      expect(props.onResolved).toHaveBeenCalledWith(
        expect.objectContaining({ resolution: "preserve_as_fork" }),
        "Night take rescue",
      ),
    );
    expect(navigation.push).toHaveBeenCalledWith(
      "/studio/60000000-0000-4000-8000-000000000123",
    );
    expect(recovery.announce).toHaveBeenCalledWith(
      "60000000-0000-4000-8000-000000000123",
      'Private fork "Night take rescue" is ready with your recovered draft.',
    );
  });

  it("does not call the database command when lifecycle acknowledgement fails", async () => {
    const user = userEvent.setup();
    const resolveAction = vi.fn();
    renderResolution({
      prepareResolution: vi.fn().mockResolvedValue(null),
      resolveAction,
    });
    await user.click(
      screen.getByRole("button", {
        name: /Draft based on revision 1.*Resolve/,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Continue from revision 2" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Start from revision 2" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Finish saving this draft before moving it.",
    );
    expect(resolveAction).not.toHaveBeenCalled();
  });

  it("refreshes changed authority without reporting a successful move", async () => {
    const user = userEvent.setup();
    const onAuthorityConflict = vi.fn();
    const props = renderResolution({
      onAuthorityConflict,
      resolveAction: vi.fn().mockResolvedValue({
        ok: false,
        code: "project_changed",
      }),
    });
    await user.click(
      screen.getByRole("button", {
        name: /Draft based on revision 1.*Resolve/,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Continue from revision 2" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Start from revision 2" }),
    );

    await waitFor(() => expect(onAuthorityConflict).toHaveBeenCalledOnce());
    expect(props.onResolved).not.toHaveBeenCalled();
    expect(recovery.clear).not.toHaveBeenCalled();
  });

  it("re-enables editing and preserves recovery after a failed command", async () => {
    const user = userEvent.setup();
    const onDecisionOpenChange = vi.fn();
    const onFailure = vi.fn();
    renderResolution({
      onDecisionOpenChange,
      onFailure,
      resolveAction: vi.fn().mockResolvedValue({
        ok: false,
        code: "unavailable",
      }),
    });
    await user.click(
      screen.getByRole("button", {
        name: /Draft based on revision 1.*Resolve/,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Continue from revision 2" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Start from revision 2" }),
    );

    await waitFor(() =>
      expect(onDecisionOpenChange).toHaveBeenLastCalledWith(false),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onFailure).toHaveBeenCalledWith(
      "The draft could not be moved. Your saved and local recovery copies are unchanged.",
    );
    expect(recovery.clear).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });
});
