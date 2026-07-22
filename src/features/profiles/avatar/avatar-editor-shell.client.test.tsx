import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AVATAR_OPTIONS, type AvatarConfigV1 } from "./contract";
import { AvatarEditorShell } from "./avatar-editor-shell.client";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const saveAvatarAction = vi.hoisted(() => vi.fn());
const resetAvatarAction = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../actions", () => ({ saveAvatarAction, resetAvatarAction }));

const initialConfig: AvatarConfigV1 = {
  version: 1,
  seed: "30000000-0000-4000-8000-000000000001",
  options: DEFAULT_AVATAR_OPTIONS,
};

function renderShell(config: AvatarConfigV1 | null = null) {
  return render(
    <AvatarEditorShell
      profileId={initialConfig.seed}
      name="Ada"
      initialConfig={config}
      initialRevision={4}
    />,
  );
}

describe("AvatarEditorShell", () => {
  beforeEach(() => {
    router.push.mockReset();
    router.refresh.mockReset();
    saveAvatarAction.mockReset();
    resetAvatarAction.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("starts defaults from initials without persisting and can save those exact defaults", async () => {
    saveAvatarAction.mockResolvedValue({
      ok: true,
      avatarConfig: initialConfig,
      avatarConfigRevision: 5,
    });
    renderShell();

    expect(saveAvatarAction).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(saveAvatarAction).toHaveBeenCalledWith({
        expectedRevision: 4,
        options: DEFAULT_AVATAR_OPTIONS,
      }),
    );
    expect(router.push).toHaveBeenCalledWith("/settings/profile?avatar=saved");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("disables Save when an existing generated avatar is unchanged", () => {
    renderShell(initialConfig);

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(saveAvatarAction).not.toHaveBeenCalled();
  });

  it("leaves without confirmation when defaults were only previewed", () => {
    renderShell();

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    cancelButton.focus();
    fireEvent.click(cancelButton);

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(router.push).toHaveBeenCalledWith("/settings/profile");
  });

  it("bounds dirty Cancel and Back navigation with an accessible confirmation", async () => {
    renderShell();
    fireEvent.click(screen.getByRole("radio", { name: "Eyes 2" }));
    expect(screen.getByText("Unsaved changes")).toBeVisible();

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    cancelButton.focus();
    fireEvent.click(cancelButton);
    const cancelDialog = screen.getByRole("alertdialog", {
      name: "Discard your changes?",
    });
    expect(
      within(cancelDialog).getByRole("button", { name: "Keep editing" }),
    ).toHaveFocus();
    expect(router.push).not.toHaveBeenCalled();
    fireEvent.keyDown(cancelDialog, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(cancelButton).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Back to profile" }));
    const backDialog = screen.getByRole("alertdialog", {
      name: "Discard your changes?",
    });
    fireEvent.click(
      within(backDialog).getByRole("button", { name: "Discard changes" }),
    );
    expect(router.push).toHaveBeenCalledWith("/settings/profile");
  });

  it("resets a saved avatar to initials through the in-app confirmation", async () => {
    resetAvatarAction.mockResolvedValue({
      ok: true,
      avatarConfig: null,
      avatarConfigRevision: 5,
    });
    renderShell(initialConfig);

    fireEvent.click(screen.getByRole("button", { name: "Reset to initials" }));

    const dialog = screen.getByRole("alertdialog", {
      name: "Reset to initials?",
    });
    expect(resetAvatarAction).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Reset avatar" }),
    );
    await waitFor(() =>
      expect(resetAvatarAction).toHaveBeenCalledWith({ expectedRevision: 4 }),
    );
    expect(router.push).toHaveBeenCalledWith("/settings/profile?avatar=reset");
  });

  it("shows actionable stale and bounded unavailable errors", async () => {
    saveAvatarAction.mockResolvedValue({
      ok: false,
      kind: "stale",
      message:
        "Your avatar changed in another tab. Refresh this page, then try again.",
    });
    renderShell();
    fireEvent.click(screen.getByRole("radio", { name: "Mouth 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "changed in another tab",
    );
    expect(router.push).not.toHaveBeenCalled();
  });
});
