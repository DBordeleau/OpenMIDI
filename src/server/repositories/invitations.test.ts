import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  activateSignupInvitation,
  parseSignupInvitationActivation,
} from "./invitations";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

const rpc = vi.fn();

describe("invitation repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ rpc } as never);
  });

  it("maps and validates the bounded activation response", async () => {
    rpc.mockResolvedValue({
      data: { email: "musician@example.test", status: "activated" },
      error: null,
    });

    await expect(
      activateSignupInvitation("musician@example.test"),
    ).resolves.toEqual({
      email: "musician@example.test",
      status: "activated",
    });
    expect(rpc).toHaveBeenCalledWith("activate_signup_invitation", {
      p_email: "musician@example.test",
    });
  });

  it("rejects malformed RPC data", () => {
    expect(() =>
      parseSignupInvitationActivation({
        email: "musician@example.test",
        status: "unexpected",
      }),
    ).toThrow();
  });

  it.each([
    ["PT400", "invalid"],
    ["PT404", "unauthorized"],
    ["08006", "unavailable"],
  ] as const)(
    "maps %s failures without exposing database messages",
    async (code, reason) => {
      rpc.mockResolvedValue({
        data: null,
        error: { code, message: "sensitive" },
      });
      await expect(
        activateSignupInvitation("musician@example.test"),
      ).rejects.toMatchObject({ reason });
    },
  );
});
