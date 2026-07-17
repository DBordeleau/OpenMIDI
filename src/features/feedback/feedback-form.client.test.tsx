import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FeedbackForm } from "./feedback-form.client";
import type { FeedbackFormState } from "./types";

afterEach(cleanup);

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByRole("textbox", { name: "Summary" }),
    "Playback loses the beat",
  );
  await user.type(
    screen.getByRole("textbox", { name: "Details" }),
    "Playback stops after the first full measure in Studio.",
  );
}

describe("feedback form", () => {
  it("discloses server context and captures browser text only after opt-in", async () => {
    const user = userEvent.setup();
    render(
      <FeedbackForm
        sourcePathname="/studio/demo"
        applicationVersion="sha-abc"
      />,
    );

    expect(screen.getByText("/studio/demo")).toBeVisible();
    expect(screen.getByText("sha-abc")).toBeVisible();
    expect(
      screen.queryByRole("textbox", {
        name: "Browser/platform text that will be sent",
      }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("checkbox", {
        name: /Share browser and platform context/i,
      }),
    );
    expect(
      screen.getByRole("textbox", {
        name: "Browser/platform text that will be sent",
      }),
    ).toHaveValue(navigator.userAgent.slice(0, 300));
  });

  it("prevents duplicate clicks while pending and clears editable fields on success", async () => {
    let resolveAction!: (state: FeedbackFormState) => void;
    const feedbackAction = vi.fn(
      () =>
        new Promise<FeedbackFormState>((resolve) => {
          resolveAction = resolve;
        }),
    );
    const user = userEvent.setup();
    render(
      <FeedbackForm
        sourcePathname="/dashboard"
        applicationVersion="test"
        feedbackAction={feedbackAction}
      />,
    );
    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Send feedback" }));

    expect(
      screen.getByRole("button", { name: "Sending feedback…" }),
    ).toBeDisabled();
    resolveAction({ message: "Thanks—saved.", referenceId: "FB-ABC123" });
    expect(await screen.findByRole("status")).toHaveTextContent("FB-ABC123");
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Summary" })).toHaveValue(""),
    );
    expect(feedbackAction).toHaveBeenCalledTimes(1);
  });

  it("announces an error and preserves input for retry", async () => {
    const user = userEvent.setup();
    render(
      <FeedbackForm
        sourcePathname="/dashboard"
        applicationVersion="test"
        feedbackAction={async () => ({
          message: "You’ve reached the feedback limit for now.",
        })}
      />,
    );
    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Send feedback" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "feedback limit",
    );
    expect(screen.getByRole("textbox", { name: "Summary" })).toHaveValue(
      "Playback loses the beat",
    );
  });
});
