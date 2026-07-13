import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "./site-header";

describe("SiteHeader", () => {
  it("links to every implemented top-level workflow", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Jam Session" })).toHaveAttribute(
      "href",
      "/",
    );
    const navigation = screen.getByRole("navigation", { name: "Primary" });
    expect(
      within(navigation).getByRole("link", { name: "New project" }),
    ).toHaveAttribute("href", "/projects/new");
    expect(
      within(navigation).getByRole("link", { name: "Uploads" }),
    ).toHaveAttribute("href", "/uploads");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });
});
