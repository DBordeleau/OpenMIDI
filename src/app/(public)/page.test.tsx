import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";

// The canvas-driven pieces do nothing meaningful in jsdom; stub them so the
// test focuses on the marketing copy and the calls to action.
vi.mock("./_components/hero-canvas.client", () => ({
  HeroCanvas: () => null,
}));
vi.mock("./_components/radial-close.client", () => ({
  RadialClose: () => null,
}));
vi.mock("./_components/diff-machine.client", () => ({
  DiffMachine: () => <h2>Revisions laid bare.</h2>,
}));
vi.mock("./_components/challenge-gauges.client", () => ({
  ChallengeGauges: () => null,
}));
vi.mock("./_components/section-scroller.client", () => ({
  SectionScroller: () => null,
}));
vi.mock("@/components/ui/reveal.client", () => ({
  Reveal: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/features/auth/auth-aware-link.client", () => ({
  AuthAwareLink: ({
    signedOut,
    className,
  }: {
    signedOut: { href: string; label: string };
    className?: string;
  }) => (
    <a href={signedOut.href} className={className}>
      {signedOut.label}
    </a>
  ),
}));

describe("Home", () => {
  it("leads with the OpenMIDI pitch and covers the core selling points", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /the song is\s*the source/i,
      }),
    ).toBeVisible();

    const primaryCtas = screen.getAllByRole("link", {
      name: /create something/i,
    });
    expect(primaryCtas[0]).toHaveAttribute("href", "/sign-in");

    expect(
      screen.getByRole("link", { name: /join the beta/i }),
    ).toHaveAttribute("href", "/sign-in");

    // The three product pillars and each core section.
    expect(
      screen.getByRole("heading", { name: /where it came from/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: /revisions laid bare/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: /constraints foster creativity/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: /see what comes back/i }),
    ).toBeVisible();
  });
});
