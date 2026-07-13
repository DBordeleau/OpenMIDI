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

    expect(screen.getByRole("link", { name: "My projects" })).toHaveAttribute(
      "href",
      "/projects",
    );
    expect(screen.getByRole("link", { name: "New project" })).toHaveAttribute(
      "href",
      "/projects/new",
    );
    expect(screen.getByRole("link", { name: "Uploads" })).toHaveAttribute(
      "href",
      "/uploads",
    );
  });

  it("marks project routes as the current workspace without masking creation", () => {
    usePathname.mockReturnValue("/projects/project-id/studio");
    const { rerender } = render(<PrimaryNavigation />);
    expect(screen.getByRole("link", { name: "My projects" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    usePathname.mockReturnValue("/projects/new");
    rerender(<PrimaryNavigation />);
    expect(screen.getByRole("link", { name: "New project" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "My projects" }),
    ).not.toHaveAttribute("aria-current");
  });
});
