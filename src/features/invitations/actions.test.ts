import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  activateSignupInvitation,
  InvitationRepositoryError,
} from "@/server/repositories/invitations";
import {
  activateSignupInvitationAction,
  type AdminInviteActionState,
} from "./actions";

vi.mock("@/server/repositories/invitations", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/repositories/invitations")>();
  return { ...actual, activateSignupInvitation: vi.fn() };
});

const initialAdminInviteState: AdminInviteActionState = { status: "idle" };

function formData(email: string) {
  const data = new FormData();
  data.set("email", email);
  return data;
}

describe("admin invitation action", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    [
      "activated",
      "Theyâ€™re on the list. musician@example.test can now sign in with Google.",
    ],
    [
      "reactivated",
      "Theyâ€™re on the list. musician@example.test can now sign in with Google.",
    ],
    ["already_active", "Theyâ€™re already on the beta list."],
  ] as const)("maps %s to a successful state", async (status, message) => {
    vi.mocked(activateSignupInvitation).mockResolvedValue({
      email: "musician@example.test",
      status,
    });

    await expect(
      activateSignupInvitationAction(
        initialAdminInviteState,
        formData(" Musician@Example.Test "),
      ),
    ).resolves.toEqual({
      status: "success",
      email: "musician@example.test",
      outcome: status,
      message,
    });
  });

  it("returns actionable validation feedback without calling the repository", async () => {
    await expect(
      activateSignupInvitationAction(
        initialAdminInviteState,
        formData("not-an-email"),
      ),
    ).resolves.toEqual({
      status: "error",
      message: "Enter a complete email address.",
    });
    expect(activateSignupInvitation).not.toHaveBeenCalled();
  });

  it.each([
    new InvitationRepositoryError("unauthorized"),
    new InvitationRepositoryError("unavailable"),
  ])("maps protected and transient failures to safe copy", async (error) => {
    vi.mocked(activateSignupInvitation).mockRejectedValue(error);
    await expect(
      activateSignupInvitationAction(
        initialAdminInviteState,
        formData("musician@example.test"),
      ),
    ).resolves.toEqual({
      status: "error",
      message: "That invite didnâ€™t save. Try again.",
    });
  });
});
