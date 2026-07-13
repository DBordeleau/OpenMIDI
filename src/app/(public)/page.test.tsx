import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";

vi.mock("./_components/hero-reveal", () => ({
  HeroReveal: ({ children }: { children: React.ReactNode }) => children,
}));

describe("Home", () => {
  it("presents the product workflow and a clear sign-in path", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /make music with a history/i,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /sign in to jam session/i }),
    ).toHaveAttribute("href", "/sign-in");
    expect(screen.getByText(/private mvp/i)).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(
      screen.getByRole("heading", { name: /companion to the daw/i }),
    ).toBeVisible();
  });
});
