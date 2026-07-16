import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";

vi.mock("./_components/hero-midi-grid", () => ({
  HeroMidiGrid: () => null,
}));
vi.mock("./_components/floating-cta.client", () => ({
  FloatingCta: () => null,
}));
vi.mock("@/components/ui/reveal.client", () => ({
  Reveal: ({ children }: { children: React.ReactNode }) => children,
}));

describe("Home", () => {
  it("leads with collaboration and covers the core selling points", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /your song isn't done/i,
      }),
    ).toBeVisible();

    const primaryCtas = screen.getAllByRole("link", {
      name: /create something/i,
    });
    expect(primaryCtas[0]).toHaveAttribute("href", "/sign-in");

    expect(screen.getByText(/invite-only/i)).toBeVisible();

    expect(
      screen.getByRole("heading", { name: /everyone in the mix/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: /nothing gets lost/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: /named, for good/i }),
    ).toBeVisible();
  });
});
