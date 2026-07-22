import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("starts defaults from initials without persisting and saves exact returned state", async () => {
    const storedConfig = {
      ...initialConfig,
      options: {
        ...DEFAULT_AVATAR_OPTIONS,
        eyebrowsVariant: "variant02" as const,
      },
    };
    saveAvatarAction.mockResolvedValue({
      ok: true,
      avatarConfig: storedConfig,
      avatarConfigRevision: 5,
    });
    renderShell();

    expect(saveAvatarAction).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "Eyebrows 2" }));
    expect(screen.getByText("Unsaved changes")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(saveAvatarAction).toHaveBeenCalledWith({
        expectedRevision: 4,
        options: storedConfig.options,
      }),
    );
    expect(router.push).toHaveBeenCalledWith("/settings/profile?avatar=saved");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("bounds dirty Cancel and Back navigation with confirmation", () => {
    const confirm = vi.mocked(window.confirm);
    confirm.mockReturnValue(false);
    renderShell();
    fireEvent.click(screen.getByRole("radio", { name: "Eyes 2" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(router.push).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Back to profile" }));
    expect(router.push).toHaveBeenCalledWith("/settings/profile");
  });

  it("resets a saved avatar to initials after confirmation", async () => {
    resetAvatarAction.mockResolvedValue({
      ok: true,
      avatarConfig: null,
      avatarConfigRevision: 5,
    });
    renderShell(initialConfig);

    fireEvent.click(screen.getByRole("button", { name: "Reset to initials" }));

    expect(window.confirm).toHaveBeenCalledWith(
      "Reset your avatar to initials everywhere?",
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
