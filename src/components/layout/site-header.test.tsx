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
import { ViewerIdentityProvider } from "./viewer-identity-provider.client";

/** Identity is resolved once above the shared navigation, not per bar. */
function renderHeader() {
  return render(
    <ViewerIdentityProvider>
      <SiteHeader />
    </ViewerIdentityProvider>,
  );
}

const getClaims = vi.fn();
const select = vi.fn();
const maybeSingle = vi.fn();

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
    from: () => ({
      select: (columns: string) => {
        select(columns);
        return { eq: () => ({ maybeSingle }) };
      },
    }),
  }),
}));

describe("SiteHeader", () => {
  beforeEach(() => {
    getClaims.mockReset();
    select.mockReset();
    maybeSingle.mockReset();
    getClaims.mockResolvedValue({ data: { claims: null }, error: null });
    maybeSingle.mockResolvedValue({ data: null });
  });
  afterEach(cleanup);

  it("shows the marketing shell with landing section links when signed out", () => {
    renderHeader();

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
    renderHeader();

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
    renderHeader();

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

  it("hydrates a generated config without resolving a Storage URL", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "30000000-0000-4000-8000-000000000001" } },
      error: null,
    });
    maybeSingle.mockResolvedValue({
      data: {
        username: "ada",
        display_name: "Ada",
        avatar_config: {
          version: 1,
          seed: "30000000-0000-4000-8000-000000000001",
          options: {
            eyebrowsVariant: "variant01",
            eyesVariant: "variant01",
            glassesVariant: "variant01",
            glassesProbability: 0,
            mouthVariant: "variant01",
            backgroundColor: "f2d3b1",
            scale: 1,
            rotate: 0,
          },
        },
      },
    });

    renderHeader();

    await waitFor(() =>
      expect(select).toHaveBeenCalledWith(
        "username,display_name,avatar_config",
      ),
    );
    const faces = await screen.findAllByRole("presentation");
    expect(
      faces.some((face) =>
        face.getAttribute("src")?.startsWith("data:image/svg+xml"),
      ),
    ).toBe(true);
  });
});
