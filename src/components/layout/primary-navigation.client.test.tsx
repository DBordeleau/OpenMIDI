import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PrimaryNavigation } from "./primary-navigation.client";

const usePathname = vi.fn();

vi.mock("next/navigation", () => ({ usePathname: () => usePathname() }));

describe("PrimaryNavigation", () => {
  beforeEach(() => usePathname.mockReturnValue("/"));
  afterEach(cleanup);

  it("exposes every implemented top-level workspace", () => {
    render(<PrimaryNavigation />);

    for (const [name, href] of [
      ["Dashboard", "/dashboard"],
      ["Studio", "/studio"],
      ["My projects", "/projects"],
      ["New project", "/projects/new"],
      ["Uploads", "/uploads"],
      ["Contributions", "/contributions"],
    ] as const)
      expect(
        screen
          .getAllByRole("link", { name })
          .every((link) => link.getAttribute("href") === href),
      ).toBe(true);
    expect(screen.getByText("Menu")).toBeInTheDocument();
  });

  it("marks Studio separately from project routes and project creation", () => {
    usePathname.mockReturnValue("/studio/project-id");
    const { rerender } = render(<PrimaryNavigation />);
    expect(
      screen
        .getAllByRole("link", { name: "Studio" })
        .every((link) => link.getAttribute("aria-current") === "page"),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: "My projects" })
        .every((link) => !link.hasAttribute("aria-current")),
    ).toBe(true);

    usePathname.mockReturnValue("/projects/project-id/studio");
    rerender(<PrimaryNavigation />);
    expect(
      screen
        .getAllByRole("link", { name: "Studio" })
        .every((link) => !link.hasAttribute("aria-current")),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: "My projects" })
        .every((link) => !link.hasAttribute("aria-current")),
    ).toBe(true);

    usePathname.mockReturnValue("/projects/new");
    rerender(<PrimaryNavigation />);
    expect(
      screen
        .getAllByRole("link", { name: "New project" })
        .every((link) => link.getAttribute("aria-current") === "page"),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: "My projects" })
        .every((link) => !link.hasAttribute("aria-current")),
    ).toBe(true);
  });

  it("marks only Contributions current on nested contribution routes", () => {
    usePathname.mockReturnValue(
      "/projects/project-id/contributions/contribution-id",
    );
    render(<PrimaryNavigation />);
    expect(
      screen
        .getAllByRole("link", { name: "Contributions" })
        .every((link) => link.getAttribute("aria-current") === "page"),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: "My projects" })
        .every((link) => !link.hasAttribute("aria-current")),
    ).toBe(true);
  });
});
