import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteHeader } from "./site-header";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("SiteHeader", () => {
  it("shows the marketing shell with landing section links when signed out", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Jam Session" })).toHaveAttribute(
      "href",
      "/",
    );

    const sections = screen.getByRole("navigation", { name: "Sections" });
    expect(
      within(sections).getByRole("link", { name: "How it works" }),
    ).toHaveAttribute("href", "/#how");
    expect(
      within(sections).getByRole("link", { name: "The studio" }),
    ).toHaveAttribute("href", "/#console");
    expect(
      within(sections).getByRole("link", { name: "Credits" }),
    ).toHaveAttribute("href", "/#credits");

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
    expect(
      screen.queryByRole("link", { name: "Create something" }),
    ).not.toBeInTheDocument();
  });
});
