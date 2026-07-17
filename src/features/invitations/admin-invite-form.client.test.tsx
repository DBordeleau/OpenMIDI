import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminInviteForm } from "./admin-invite-form.client";
import type { AdminInviteActionState } from "./actions";

afterEach(cleanup);

describe("administrator invitation form", () => {
  it("exposes a visible email label and a pending state", async () => {
    let resolveAction!: (state: AdminInviteActionState) => void;
    const inviteAction = vi.fn(
      () =>
        new Promise<AdminInviteActionState>((resolve) => {
          resolveAction = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<AdminInviteForm inviteAction={inviteAction} />);

    await user.type(
      screen.getByRole("textbox", { name: "Collaborator email" }),
      "musician@example.test",
    );
    await user.click(screen.getByRole("button", { name: "Add to beta" }));

    expect(screen.getByRole("button", { name: "Addingâ€¦" })).toBeDisabled();
    resolveAction({
      status: "success",
      outcome: "activated",
      email: "musician@example.test",
      message:
        "Theyâ€™re on the list. musician@example.test can now sign in with Google.",
    });
    await screen.findByRole("status");
  });

  it("announces success with the normalized address and clears a new activation", async () => {
    const user = userEvent.setup();
    render(
      <AdminInviteForm
        inviteAction={async () => ({
          status: "success",
          outcome: "activated",
          email: "musician@example.test",
          message:
            "Theyâ€™re on the list. musician@example.test can now sign in with Google.",
        })}
      />,
    );
    const input = screen.getByRole("textbox", { name: "Collaborator email" });
    await user.type(input, "Musician@Example.Test");
    await user.click(screen.getByRole("button", { name: "Add to beta" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "musician@example.test can now sign in with Google",
    );
    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("uses an alert and preserves the address on error", async () => {
    const user = userEvent.setup();
    render(
      <AdminInviteForm
        inviteAction={async () => ({
          status: "error",
          message: "That invite didnâ€™t save. Try again.",
        })}
      />,
    );
    const input = screen.getByRole("textbox", { name: "Collaborator email" });
    await user.type(input, "musician@example.test");
    await user.click(screen.getByRole("button", { name: "Add to beta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That invite didnâ€™t save. Try again.",
    );
    expect(input).toHaveValue("musician@example.test");
  });
});
