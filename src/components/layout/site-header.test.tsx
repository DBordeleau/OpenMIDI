import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "./site-header";

const getClaims = vi.fn();

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
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
vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getClaims,
      onAuthStateChange: (callback: () => void) => {
        queueMicrotask(callback);
        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        };
      },
    },
  }),
}));

describe("SiteHeader", () => {
  beforeEach(() => {
    getClaims.mockReset();
    getClaims.mockResolvedValue({ data: { claims: null }, error: null });
  });
  afterEach(cleanup);

  it("shows the marketing shell with landing section links when signed out", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "OpenMIDI" })).toHaveAttribute(
      "href",
      "/",
    );

    const sections = screen.getByRole("navigation", { name: "Sections" });
    expect(
      within(sections).getByRole("link", { name: "The MIDI Library" }),
    ).toHaveAttribute("href", "/library");
    expect(
      within(sections).getByRole("link", { name: "Versioning" }),
    ).toHaveAttribute("href", "/#versioning");
    expect(
      within(sections).getByRole("link", { name: "Challenges" }),
    ).toHaveAttribute("href", "/challenges");

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
    expect(
      screen.queryByRole("link", { name: "Create something" }),
    ).not.toBeInTheDocument();

    expect(
      screen
        .getAllByRole("link")
        .every((link) => link.getAttribute("data-prefetch") === "false"),
    ).toBe(true);
  });

  it("swaps to the workspace nav and avatar account menu when signed in", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "viewer-id" } },
      error: null,
    });
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "data-prefetch",
      "false",
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Account menu" }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole("link", { name: "Account" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();

    // Navigation stays request-bounded: nothing prefetches before intent.
    expect(
      screen
        .getAllByRole("link")
        .every((link) => link.getAttribute("data-prefetch") === "false"),
    ).toBe(true);
  });

  it("opens the account menu with the destinations moved out of the nav bar", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "viewer-id" } },
      error: null,
    });
    render(<SiteHeader />);

    const trigger = await screen.findByRole("button", { name: "Account menu" });
    fireEvent.click(trigger);

    for (const [name, href] of [
      ["My projects", "/projects"],
      ["Saved clips", "/library/saved"],
      ["Contributions", "/contributions"],
      ["Edit profile", "/settings/profile"],
    ] as const)
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
  });
});
