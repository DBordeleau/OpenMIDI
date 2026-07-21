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

    // Account destinations moved behind the avatar menu.
    expect(screen.queryByRole("link", { name: "Contributions" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Account" })).toBeNull();
    expect(screen.getByText("Menu")).toBeInTheDocument();
  });

  it("groups discovery destinations behind Explore", () => {
    render(<PrimaryNavigation />);
    const nav = openExplore();

    for (const [name, href] of [
      ["MIDI Library", "/library"],
      ["Projects", "/explore"],
      ["Challenges", "/challenges"],
    ] as const)
      expect(within(nav).getByRole("link", { name })).toHaveAttribute(
        "href",
        href,
      );
    expect(
      within(nav).getByRole("button", { name: "Explore" }),
    ).toHaveAttribute("aria-expanded", "true");
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

  it("prefetches desktop and mobile destinations only after intent", () => {
    render(<PrimaryNavigation />);

    const studioLinks = screen.getAllByRole("link", { name: "Studio" });
    expect(
      studioLinks.every(
        (link) => link.getAttribute("data-prefetch") === "false",
      ),
    ).toBe(true);

    fireEvent.focus(studioLinks[0]);
    expect(studioLinks[0]).toHaveAttribute("data-prefetch", "default");
    expect(studioLinks[1]).toHaveAttribute("data-prefetch", "false");
  });

  it("marks Studio separately from project studio routes", () => {
    usePathname.mockReturnValue("/studio/project-id");
    const { rerender } = render(<PrimaryNavigation />);
    expect(
      screen
        .getAllByRole("link", { name: "Studio" })
        .every((link) => link.getAttribute("aria-current") === "page"),
    ).toBe(true);

    usePathname.mockReturnValue("/projects/project-id/studio");
    rerender(<PrimaryNavigation />);
    expect(
      screen
        .getAllByRole("link", { name: "Studio" })
        .every((link) => !link.hasAttribute("aria-current")),
    ).toBe(true);
  });
});
