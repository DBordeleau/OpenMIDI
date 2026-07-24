import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Link from "next/link";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DetailNavigationPresentation } from "@/features/discovery/detail-navigation-presentation.client";

const { usePathname, routerPush } = vi.hoisted(() => ({
  usePathname: vi.fn(() => "/explore"),
  routerPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
  useRouter: () => ({ push: routerPush }),
}));

describe("DetailNavigationPresentation", () => {
  afterEach(cleanup);

  beforeEach(() => {
    usePathname.mockReturnValue("/explore");
    routerPush.mockReset();
  });

  it("shows the project-specific presentation for an exact detail navigation", () => {
    render(
      <>
        <DetailNavigationPresentation />
        <Link
          href="/projects/e1000000-0000-4000-8000-000000000001"
          onClick={(event) => event.preventDefault()}
        >
          Open project
        </Link>
      </>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Open project" }));

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading project details…");
    expect(status.parentElement?.parentElement).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.queryByText("My projects")).not.toBeInTheDocument();
  });

  it("shows the pattern-specific presentation and ignores modified clicks", () => {
    render(
      <>
        <DetailNavigationPresentation />
        <Link
          href="/library/ea000000-0000-4000-8000-000000000001"
          onClick={(event) => event.preventDefault()}
        >
          Open pattern
        </Link>
      </>,
    );
    const link = screen.getByRole("link", { name: "Open pattern" });

    fireEvent.click(link, { ctrlKey: true });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.click(link);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading MIDI pattern details…",
    );
    expect(screen.queryByText("Find a pattern")).not.toBeInTheDocument();
  });

  it("does not intercept navigation from Studio", () => {
    usePathname.mockReturnValue("/studio/e1000000-0000-4000-8000-000000000001");
    render(
      <>
        <DetailNavigationPresentation />
        <Link
          href="/projects/e1000000-0000-4000-8000-000000000001"
          onClick={(event) => event.preventDefault()}
        >
          Exit Studio
        </Link>
      </>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Exit Studio" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
