import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthAwareLink } from "./auth-aware-link.client";

const getClaims = vi.fn();
const unsubscribe = vi.fn();
let authChange: (() => void) | undefined;

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getClaims,
      onAuthStateChange: (callback: () => void) => {
        authChange = callback;
        queueMicrotask(callback);
        return { data: { subscription: { unsubscribe } } };
      },
    },
  }),
}));

const states = {
  signedOut: { href: "/sign-in", label: "Sign in" },
  signedIn: { href: "/settings/profile", label: "Account" },
};

describe("AuthAwareLink", () => {
  beforeEach(() => {
    getClaims.mockReset();
    unsubscribe.mockReset();
    authChange = undefined;
  });

  it("progressively replaces sign in with the authenticated destination", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "viewer-id" } },
      error: null,
    });
    render(<AuthAwareLink {...states} />);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute(
        "href",
        "/settings/profile",
      ),
    );
  });

  it("refreshes verified claims after an auth event", async () => {
    getClaims
      .mockResolvedValueOnce({ data: { claims: null }, error: null })
      .mockResolvedValueOnce({
        data: { claims: { sub: "viewer-id" } },
        error: null,
      });
    render(<AuthAwareLink {...states} />);
    await waitFor(() => expect(getClaims).toHaveBeenCalledOnce());

    authChange?.();

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Account" })).toBeVisible(),
    );
  });
});
