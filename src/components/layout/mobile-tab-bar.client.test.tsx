import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MobileTabBar,
  shouldDismissMobileSheet,
} from "./mobile-tab-bar.client";

const usePathname = vi.fn();
const viewer = vi.hoisted(() => ({
  signedIn: true,
  username: null as string | null,
  displayName: "Your account" as string | null,
  avatarConfig: null,
}));

vi.mock("next/navigation", () => ({ usePathname: () => usePathname() }));
vi.mock("next/link", () => ({
  default: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: unknown }) => (
    <a
      {...props}
      data-prefetch={
        prefetch === false
          ? "false"
          : prefetch === null
            ? "default"
            : "unspecified"
      }
    />
  ),
}));
vi.mock("@/features/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("./viewer-identity-provider.client", () => ({
  useViewer: () => viewer,
}));

function tabs() {
  return screen.getByRole("navigation", { name: "Primary mobile" });
}

describe("MobileTabBar", () => {
  beforeEach(() => {
    usePathname.mockReturnValue("/dashboard");
    viewer.username = null;
    viewer.displayName = "Your account";
  });
  afterEach(cleanup);

  it("offers the same four top-level destinations as the desktop header", () => {
    render(<MobileTabBar />);

    expect(
      within(tabs()).getByRole("link", { name: "Dashboard" }),
    ).toHaveAttribute("href", "/dashboard");
    expect(
      within(tabs()).getByRole("link", { name: "Studio" }),
    ).toHaveAttribute("href", "/studio");
    expect(
      within(tabs()).getByRole("button", { name: "Explore" }),
    ).toBeInTheDocument();
    expect(
      within(tabs()).getByRole("button", { name: "Account" }),
    ).toBeInTheDocument();
    expect(within(tabs()).getAllByRole("link")).toHaveLength(2);
  });

  it("raises the Explore sheet with the grouped discovery destinations", () => {
    render(<MobileTabBar />);
    fireEvent.click(within(tabs()).getByRole("button", { name: "Explore" }));

    const sheet = screen.getByRole("dialog", { name: "Explore" });
    for (const [name, href] of [
      ["MIDI Library", "/library"],
      ["Projects", "/explore"],
      ["Challenges", "/challenges"],
    ] as const)
      expect(within(sheet).getByRole("link", { name })).toHaveAttribute(
        "href",
        href,
      );
    expect(
      within(tabs()).getByRole("button", { name: "Explore" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(sheet).toHaveClass("bottom-full");
    expect(sheet.parentElement).toBe(tabs().parentElement);
  });

  it("turns the sheet handle into a working close control", () => {
    render(<MobileTabBar />);
    const explore = within(tabs()).getByRole("button", { name: "Explore" });
    fireEvent.click(explore);

    fireEvent.click(screen.getByRole("button", { name: "Close Explore menu" }));

    expect(explore).toHaveAttribute("aria-expanded", "false");
  });

  it("raises the account sheet and keeps sign out inside it", () => {
    viewer.username = "NightSignal";
    viewer.displayName = "Night Signal";
    render(<MobileTabBar />);
    fireEvent.click(within(tabs()).getByRole("button", { name: "Account" }));

    const sheet = screen.getByRole("dialog", { name: "Account" });
    for (const [name, href] of [
      ["View profile", "/@NightSignal"],
      ["My projects", "/projects"],
      ["Saved clips", "/library/saved"],
      ["Contributions", "/contributions"],
      ["Edit profile", "/settings/profile"],
    ] as const)
      expect(within(sheet).getByRole("link", { name })).toHaveAttribute(
        "href",
        href,
      );
    expect(
      within(sheet).getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
  });

  it("omits View profile while the verified profile is incomplete", () => {
    render(<MobileTabBar />);
    fireEvent.click(within(tabs()).getByRole("button", { name: "Account" }));

    expect(
      within(screen.getByRole("dialog", { name: "Account" })).queryByRole(
        "link",
        { name: "View profile" },
      ),
    ).toBeNull();
  });

  it("swaps sheet contents in place rather than stacking two dialogs", () => {
    render(<MobileTabBar />);
    fireEvent.click(within(tabs()).getByRole("button", { name: "Explore" }));
    fireEvent.click(within(tabs()).getByRole("button", { name: "Account" }));

    expect(screen.queryByRole("dialog", { name: "Explore" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Account" })).toBeInTheDocument();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("closes the open sheet on a second tap of its own tab", () => {
    render(<MobileTabBar />);
    const account = () =>
      within(tabs()).getByRole("button", { name: "Account" });

    fireEvent.click(account());
    expect(account()).toHaveAttribute("aria-expanded", "true");

    // The element itself lingers for the slide-out; `aria-expanded` is the
    // contract assistive technology and the component's own logic read.
    fireEvent.click(account());
    expect(account()).toHaveAttribute("aria-expanded", "false");
  });

  it("marks the tab that owns the current route", () => {
    usePathname.mockReturnValue("/library/listing-id");
    render(<MobileTabBar />);

    expect(
      within(tabs()).getByRole("link", { name: "Dashboard" }),
    ).not.toHaveAttribute("aria-current");
    // Explore owns /library, so its tab reads as current without being open.
    expect(
      within(tabs()).getByRole("button", { name: "Explore" }),
    ).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(within(tabs()).getByRole("button", { name: "Explore" }));
    expect(
      within(screen.getByRole("dialog", { name: "Explore" })).getByRole(
        "link",
        {
          name: "MIDI Library",
        },
      ),
    ).toHaveAttribute("aria-current", "page");
  });

  it("keeps tab destinations cold until intent", () => {
    render(<MobileTabBar />);
    expect(
      within(tabs())
        .getAllByRole("link")
        .every((link) => link.getAttribute("data-prefetch") === "false"),
    ).toBe(true);
  });

  it("dismisses only deliberate downward sheet gestures", () => {
    expect(shouldDismissMobileSheet({ offsetY: 72, velocityY: 0 })).toBe(true);
    expect(shouldDismissMobileSheet({ offsetY: 12, velocityY: 650 })).toBe(
      true,
    );
    expect(shouldDismissMobileSheet({ offsetY: 48, velocityY: 300 })).toBe(
      false,
    );
    expect(shouldDismissMobileSheet({ offsetY: -24, velocityY: -800 })).toBe(
      false,
    );
  });
});
