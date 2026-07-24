import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PrimaryNavigation } from "./primary-navigation.client";

const usePathname = vi.fn();

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

function openExplore() {
  const nav = screen.getByRole("navigation", { name: "Primary" });
  fireEvent.click(within(nav).getByRole("button", { name: "Explore" }));
  return nav;
}

describe("PrimaryNavigation", () => {
  beforeEach(() => usePathname.mockReturnValue("/"));
  afterEach(cleanup);

  it("keeps the workspace to four top-level destinations", () => {
    render(<PrimaryNavigation />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(
      within(nav).getByRole("link", { name: "Dashboard" }),
    ).toHaveAttribute("href", "/dashboard");
    expect(within(nav).getByRole("link", { name: "Studio" })).toHaveAttribute(
      "href",
      "/studio",
    );
    expect(within(nav).getAllByRole("link")).toHaveLength(2);
    expect(
      within(nav).getByRole("button", { name: "Explore" }),
    ).toHaveAttribute("aria-expanded", "false");

    // Account destinations belong to the avatar menu, not the nav bar.
    expect(screen.queryByRole("link", { name: "Contributions" })).toBeNull();
  });

  it("leaves the phone to the tab bar instead of duplicating a disclosure", () => {
    render(<PrimaryNavigation />);

    expect(screen.queryByText("Menu")).toBeNull();
    expect(
      screen.queryByRole("navigation", { name: "Primary mobile" }),
    ).toBeNull();
  });

  it("groups discovery destinations behind Explore", () => {
    render(<PrimaryNavigation />);
    const nav = openExplore();
    const trigger = within(nav).getByRole("button", { name: "Explore" });
    const panelId = trigger.getAttribute("aria-controls");

    for (const [name, href] of [
      ["MIDI Library", "/library"],
      ["Projects", "/explore"],
      ["Challenges", "/challenges"],
    ] as const)
      expect(within(nav).getByRole("link", { name })).toHaveAttribute(
        "href",
        href,
      );
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId!)).toHaveClass("left-0", "w-60");
  });

  it("closes on Escape and restores focus to the Explore trigger", () => {
    render(<PrimaryNavigation />);
    const nav = openExplore();
    const trigger = within(nav).getByRole("button", { name: "Explore" });
    within(nav).getByRole("link", { name: "MIDI Library" }).focus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("marks Explore current for any destination it owns", () => {
    usePathname.mockReturnValue("/library/listing-id");
    render(<PrimaryNavigation />);
    const nav = openExplore();

    expect(
      within(nav).getByRole("link", { name: "MIDI Library" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(nav).getByRole("link", { name: "Projects" }),
    ).not.toHaveAttribute("aria-current");
    expect(
      within(nav).getByRole("link", { name: "Dashboard" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("prefetches destinations only after intent", () => {
    render(<PrimaryNavigation />);

    const studio = screen.getByRole("link", { name: "Studio" });
    expect(studio).toHaveAttribute("data-prefetch", "false");

    fireEvent.focus(studio);
    expect(studio).toHaveAttribute("data-prefetch", "default");
  });

  it("marks Studio separately from project studio routes", () => {
    usePathname.mockReturnValue("/studio/project-id");
    const { rerender } = render(<PrimaryNavigation />);
    expect(screen.getByRole("link", { name: "Studio" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    usePathname.mockReturnValue("/projects/project-id/studio");
    rerender(<PrimaryNavigation />);
    expect(screen.getByRole("link", { name: "Studio" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
