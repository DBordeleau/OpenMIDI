import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ProfileOwnerAction,
  viewerOwnsProfile,
} from "./profile-owner-action.client";

const useViewer = vi.hoisted(() => vi.fn());

vi.mock("@/components/layout/viewer-identity-provider.client", () => ({
  useViewer: () => useViewer(),
}));

describe("ProfileOwnerAction", () => {
  afterEach(cleanup);

  it("shows Edit profile only for the verified viewer profile username", () => {
    useViewer.mockReturnValue({
      signedIn: true,
      username: "NightSignal",
      displayName: "Night Signal",
      avatarConfig: null,
    });
    const { rerender } = render(
      <ProfileOwnerAction profileUsername="nightsignal" />,
    );

    expect(screen.getByRole("link", { name: "Edit profile" })).toHaveAttribute(
      "href",
      "/settings/profile",
    );

    rerender(<ProfileOwnerAction profileUsername="another-artist" />);
    expect(screen.queryByRole("link", { name: "Edit profile" })).toBeNull();
  });

  it("does not render prematurely for signed-out or incomplete identities", () => {
    useViewer.mockReturnValue({
      signedIn: true,
      username: null,
      displayName: null,
      avatarConfig: null,
    });
    const { rerender } = render(
      <ProfileOwnerAction profileUsername="NightSignal" />,
    );
    expect(screen.queryByRole("link", { name: "Edit profile" })).toBeNull();

    useViewer.mockReturnValue({
      signedIn: false,
      username: "NightSignal",
      displayName: "Night Signal",
      avatarConfig: null,
    });
    rerender(<ProfileOwnerAction profileUsername="NightSignal" />);
    expect(screen.queryByRole("link", { name: "Edit profile" })).toBeNull();
    expect(viewerOwnsProfile("NightSignal", "nightsignal")).toBe(true);
  });
});
